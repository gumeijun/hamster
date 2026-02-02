/**
 * Application Entry Point
 * 
 * This is the main entry file for the React application.
 * It initializes the React root and renders the main App component.
 */

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
