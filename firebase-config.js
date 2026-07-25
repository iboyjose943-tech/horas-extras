// Configuración de tu proyecto Firebase (horas-extras)
const firebaseConfig = {
  apiKey: "AIzaSyDVvwP6RXVXEZRKGnVA30q2jQxdrB80pfw",
  authDomain: "horas-extras-9192b.firebaseapp.com",
  projectId: "horas-extras-9192b",
  storageBucket: "horas-extras-9192b.firebasestorage.app",
  messagingSenderId: "572273863961",
  appId: "1:572273863961:web:1ab5287d5c8cdc40e96988"
};

firebase.initializeApp(firebaseConfig);

// Variables globales que usan login.js y main.js
const auth = firebase.auth();
const db   = firebase.firestore();