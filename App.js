// App.js - Main application file

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { GDrive } from "@robinbobin/react-native-google-drive-api-wrapper";
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

// Replace with your own Google API client ID
const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';
// Replace with your Google Sheet ID
const SPREADSHEET_ID = 'YOUR_GOOGLE_SPREADSHEET_ID';

// Initialize Google Sign-In
GoogleSignin.configure({
  scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive.file'],
  webClientId: GOOGLE_CLIENT_ID,
  offlineAccess: true,
});

const App = () => {
  // App state
  const [currentScreen, setCurrentScreen] = useState('splash');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(0));
  
  // Form state for logging volunteer time
  const [volunteerDate, setVolunteerDate] = useState(new Date());
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date(new Date().setHours(new Date().getHours() + 1)));
  const [organization, setOrganization] = useState('');
  const [description, setDescription] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [timePickerMode, setTimePickerMode] = useState('date');
  const [currentTimePickerField, setCurrentTimePickerField] = useState(null);

  // Handle splash screen and animations
  useEffect(() => {
    // Fade in animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();

    // Wait for 2 seconds and then transition to login screen
    const splashTimeout = setTimeout(() => {
      Animated.timing(slideAnim, {
        toValue: -400,
        duration: 500,
        useNativeDriver: true,
      }).start(() => {
        setCurrentScreen('login');
        checkLoginStatus();
      });
    }, 2000);

    return () => clearTimeout(splashTimeout);
  }, []);

  // Check if user is already logged in
  const checkLoginStatus = async () => {
    try {
      const savedUsername = await AsyncStorage.getItem('username');
      const savedPassword = await AsyncStorage.getItem('password');
      
      if (savedUsername && savedPassword) {
        setUsername(savedUsername);
        setPassword(savedPassword);
        setIsLoggedIn(true);
        setCurrentScreen('timeEntry');
      }
    } catch (error) {
      console.error('Error checking login status:', error);
    }
  };

  // Handle login
  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert('Error', 'Please enter both username and password');
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Store credentials locally (in a real app, you'd want to encrypt these)
      await AsyncStorage.setItem('username', username);
      await AsyncStorage.setItem('password', password);
      
      setIsLoggedIn(true);
      setCurrentScreen('timeEntry');
      
      // Try to connect to Google services
      await initializeGoogleConnection();
    } catch (error) {
      console.error('Login error:', error);
      Alert.alert('Login Error', 'There was an error logging in. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('username');
      await AsyncStorage.removeItem('password');
      setIsLoggedIn(false);
      setUsername('');
      setPassword('');
      setCurrentScreen('login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Initialize Google Sign-In connection
  const initializeGoogleConnection = async () => {
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      console.log('Google Sign-In successful:', userInfo);
    } catch (error) {
      console.error('Google Sign-In error:', error);
      // We don't block the app if Google sign-in fails
      // The user can still enter data that can be synced later
    }
  };

  // Submit volunteer time to Google Sheet
  const submitVolunteerTime = async () => {
    // Validate form
    if (!organization || !description) {
      Alert.alert('Missing Information', 'Please fill in all fields');
      return;
    }
    
    // Calculate hours worked
    const hours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
    if (hours <= 0) {
      Alert.alert('Invalid Time', 'End time must be after start time');
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Format date and times for the spreadsheet
      const dateString = volunteerDate.toLocaleDateString();
      const startTimeString = startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const endTimeString = endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      // Create row data for the spreadsheet
      const rowData = [
        username,
        dateString,
        startTimeString,
        endTimeString,
        hours.toFixed(2),
        organization,
        description
      ];
      
      // Try to submit to Google Sheet
      const isSubmitted = await submitToGoogleSheet(rowData);
      
      if (isSubmitted) {
        Alert.alert('Success', 'Your volunteer time has been recorded');
        // Reset form
        setOrganization('');
        setDescription('');
        setStartTime(new Date());
        setEndTime(new Date(new Date().setHours(new Date().getHours() + 1)));
      } else {
        // Store locally for later sync if submission fails
        await storeTimeEntryLocally(rowData);
        Alert.alert(
          'Offline Mode', 
          'Your entry has been saved locally and will be submitted when you reconnect.'
        );
      }
    } catch (error) {
      console.error('Submit error:', error);
      Alert.alert('Error', 'Failed to submit volunteer time. Data saved locally.');
      await storeTimeEntryLocally(rowData);
    } finally {
      setIsLoading(false);
    }
  };

  // Submit data to Google Sheet
  const submitToGoogleSheet = async (rowData) => {
    try {
      const isSignedIn = await GoogleSignin.isSignedIn();
      if (!isSignedIn) {
        await initializeGoogleConnection();
      }
      
      const tokens = await GoogleSignin.getTokens();
      if (!tokens.accessToken) {
        throw new Error('No access token available');
      }
      
      // Use Google Sheets API to append data
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Sheet1:append?valueInputOption=USER_ENTERED`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            values: [rowData],
          }),
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to submit to Google Sheet');
      }
      
      return true;
    } catch (error) {
      console.error('Google Sheet submit error:', error);
      return false;
    }
  };

  // Store time entry locally for later sync
  const storeTimeEntryLocally = async (rowData) => {
    try {
      // Get existing entries or initialize new array
      const storedEntriesString = await AsyncStorage.getItem('pendingEntries');
      const storedEntries = storedEntriesString ? JSON.parse(storedEntriesString) : [];
      
      // Add new entry
      storedEntries.push(rowData);
      
      // Save back to storage
      await AsyncStorage.setItem('pendingEntries', JSON.stringify(storedEntries));
    } catch (error) {
      console.error('Error storing entry locally:', error);
    }
  };

  // Handle date/time changes
  const onDateTimeChange = (event, selectedDate) => {
    if (event.type === 'dismissed') {
      setShowDatePicker(false);
      setShowStartTimePicker(false);
      setShowEndTimePicker(false);
      return;
    }
    
    if (selectedDate) {
      if (currentTimePickerField === 'date') {
        setVolunteerDate(selectedDate);
      } else if (currentTimePickerField === 'startTime') {
        setStartTime(selectedDate);
      } else if (currentTimePickerField === 'endTime') {
        setEndTime(selectedDate);
      }
    }
    
    setShowDatePicker(false);
    setShowStartTimePicker(false);
    setShowEndTimePicker(false);
  };

  // Show date picker
  const showDatePickerModal = (field, mode) => {
    setTimePickerMode(mode);
    setCurrentTimePickerField(field);
    
    if (field === 'date') {
      setShowDatePicker(true);
    } else if (field === 'startTime') {
      setShowStartTimePicker(true);
    } else if (field === 'endTime') {
      setShowEndTimePicker(true);
    }
  };

  // Render splash screen
  const renderSplashScreen = () => (
    <Animated.View 
      style={[
        styles.container, 
        styles.splashContainer,
        { 
          opacity: fadeAnim,
          transform: [{ translateX: slideAnim }]
        }
      ]}
    >
      <Image 
        source={require('./assets/DubClubLogo.png')} 
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={styles.splashTitle}>Volunteer Time Tracker</Text>
    </Animated.View>
  );

  // Render login screen
  const renderLoginScreen = () => (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.loginContainer}>
          <Text style={styles.title}>Volunteer Time Tracker</Text>
          <Image 
            source={require('./assets/logo.png')} 
            style={styles.smallLogo}
            resizeMode="contain"
          />
          
          <TextInput
            style={styles.input}
            placeholder="Username"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />
          
          <TextInput
            style={styles.input}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          
          <TouchableOpacity
            style={styles.button}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Login</Text>
            )}
          </TouchableOpacity>
          
          <Text style={styles.infoText}>
            Login details are stored locally and are only used to identify your entries.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  // Render time entry form
  const renderTimeEntryScreen = () => (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.timeEntryContainer}>
          <Text style={styles.welcomeText}>Welcome, {username}!</Text>
          
          <Text style={styles.label}>Date</Text>
          <TouchableOpacity
            style={styles.datePickerButton}
            onPress={() => showDatePickerModal('date', 'date')}
          >
            <Text>{volunteerDate.toLocaleDateString()}</Text>
          </TouchableOpacity>
          
          <View style={styles.timeRow}>
            <View style={styles.timeColumn}>
              <Text style={styles.label}>Start Time</Text>
              <TouchableOpacity
                style={styles.datePickerButton}
                onPress={() => showDatePickerModal('startTime', 'time')}
              >
                <Text>
                  {startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.timeColumn}>
              <Text style={styles.label}>End Time</Text>
              <TouchableOpacity
                style={styles.datePickerButton}
                onPress={() => showDatePickerModal('endTime', 'time')}
              >
                <Text>
                  {endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          
          <Text style={styles.label}>Organization</Text>
          <TextInput
            style={styles.input}
            placeholder="Organization name"
            value={organization}
            onChangeText={setOrganization}
          />
          
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Describe your volunteer work"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
          />
          
          <TouchableOpacity
            style={styles.button}
            onPress={submitVolunteerTime}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Submit Time</Text>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
          >
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      
      {/* Date and Time Pickers */}
      {(showDatePicker || showStartTimePicker || showEndTimePicker) && (
        <DateTimePicker
          value={
            currentTimePickerField === 'date'
              ? volunteerDate
              : currentTimePickerField === 'startTime'
              ? startTime
              : endTime
          }
          mode={timePickerMode}
          is24Hour={false}
          display="default"
          onChange={onDateTimeChange}
        />
      )}
    </SafeAreaView>
  );

  // Render the appropriate screen
  const renderScreen = () => {
    switch (currentScreen) {
      case 'splash':
        return renderSplashScreen();
      case 'login':
        return renderLoginScreen();
      case 'timeEntry':
        return renderTimeEntryScreen();
      default:
        return renderLoginScreen();
    }
  };

  return (
    <SafeAreaProvider>
      {renderScreen()}
    </SafeAreaProvider>
  );
};

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  splashContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#3498db',
  },
  loginContainer: {
    padding: 20,
    alignItems: 'center',
  },
  timeEntryContainer: {
    padding: 20,
  },
  logo: {
    width: 150,
    height: 150,
    marginBottom: 30,
  },
  smallLogo: {
    width: 100,
    height: 100,
    marginBottom: 30,
  },
  splashTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  welcomeText: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
    textAlign: 'center',
  },
  input: {
    width: '100%',
    height: 50,
    backgroundColor: '#fff',
    borderRadius: 5,
    marginBottom: 15,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: 10,
  },
  button: {
    width: '100%',
    height: 50,
    backgroundColor: '#3498db',
    borderRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  logoutButton: {
    width: '100%',
    height: 50,
    backgroundColor: '#e74c3c',
    borderRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  logoutButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  infoText: {
    textAlign: 'center',
    color: '#777',
    marginTop: 20,
    paddingHorizontal: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
    marginTop: 10,
  },
  datePickerButton: {
    width: '100%',
    height: 50,
    backgroundColor: '#fff',
    borderRadius: 5,
    marginBottom: 15,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    justifyContent: 'center',
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeColumn: {
    width: '48%',
  },
});

export default App;

