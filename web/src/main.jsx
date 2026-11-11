import React from 'react'
import ReactDOM from 'react-dom/client'
import './styles/tokens.css'
import './styles/components.css'
import './styles/base.css'
import { AppProvider } from './lib/store.jsx'
import App from './App.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><AppProvider><App /></AppProvider></React.StrictMode>
)
