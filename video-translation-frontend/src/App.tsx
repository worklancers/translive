import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './App.css';
import {io, Socket} from 'socket.io-client'

interface Language {
  lang_code: string;
  lang_name: string;
  url: string;
}

const App: React.FC = () => {
  const [apiToken, setApiToken] = useState<string>(''); // Token for API calls
  const [languages, setLanguages] = useState<Language[]>([]); // Fetched languages
  const [sourceLanguage, setSourceLanguage] = useState<string | null>(null); // Source Language selection
  const [targetLanguage, setTargetLanguage] = useState<string | null>(null); // Target Language selection
  const [videoUrl, setVideoUrl] = useState<string>('https://drz0f01yeq1cx.cloudfront.net/1710470596011-facebook.mp4'); // URL for translation
  const [lipSync, setLipSync] = useState<boolean>(false); // Lip sync checkbox
  const [error, setError] = useState<string | null>(null); // Error state
  const [fetchingLanguages, setFetchingLanguages] = useState<boolean>(false); // Loader for language fetch
  const [isTranslating, setIsTranslating] = useState<boolean>(false); // Loader for translation process
  const [translationResult, setTranslationResult] = useState<string | React.ReactNode | null>(null);
  const languageListingUrl = 'https://openapi.akool.com/api/open/v3/language/list'; // Language API URL
  const socket = useRef<Socket>();
  const [processingVideoUrl, setProcessingVideoUrl] = useState<string | null>(null);
  const [showProcessingPopup, setShowProcessingPopup] = useState<boolean>(false);
  const [showErrorPopup, setShowErrorPopup] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [clientId, setClientId] = useState<string>('');
  const [clientSecret, setClientSecret] = useState<string>('');
  const [isTokenLoading, setIsTokenLoading] = useState<boolean>(false);
  const [authMethod, setAuthMethod] = useState<'credentials' | 'token'>('token');
  const [activeTab, setActiveTab] = useState<'input' | 'generate'>('input');
  const [tempToken, setTempToken] = useState<string>('');
  


  useEffect(()=>{
    socket.current = io('http://localhost:3007');
    socket.current.on("connect", () => {
      console.log("Connected to WebSocket server");
    });
    
    socket.current.on("message", async (msg) => {
      if (msg.type === 'event') {
        console.log("GETTING DATA from websocket:::", msg.data);
        
        // Check if lipSync was selected
        const wasLipSyncSelected = localStorage.getItem('lipSyncSelected') === 'true';
        
        if (wasLipSyncSelected && msg.data._id) {
          try {
            const response = await axios.get(
              `http://openapi.akool.com/api/open/v3/content/video/infobymodelid?video_model_id=${msg.data._id}`,
              {
                headers: { Authorization: `Bearer ${apiToken}` }
              }
            );
            console.log("Lip sync video info response:", response.data);
          } catch (error) {
            console.error("Error fetching lip sync video info:", error);
          }
        }

        setProcessingVideoUrl(msg.data.url);
        setShowProcessingPopup(false);
      } else if (msg.type === 'error') {
        setShowProcessingPopup(false);
        setErrorMessage(msg.message);
        setShowErrorPopup(true);
      }
    });

    return () => {
      socket.current?.close();
    }
  }, [apiToken]);

  useEffect(() => {
    if (apiToken) {
      setFetchingLanguages(true);
      fetchLanguages();
    }
  }, [apiToken]);

  const fetchLanguages = async () => {
    if (!apiToken) return;
    
    setError(null);
    setLanguages([]);
    setSourceLanguage(null);
    setTargetLanguage(null);
    setLipSync(false);
    try {
      const response = await axios.get(languageListingUrl, {
        headers: { Authorization: `Bearer ${apiToken}` },
      });
      const data = response.data;
      if (data.code === 1000) {
        setLanguages(data.data.lang_list || []);
      } else {
        setError(data.msg || 'Failed to fetch languages.');
      }
    } catch (err) {
      setError('An error occurred while fetching languages.');
      console.error(err);
    } finally {
      setFetchingLanguages(false);
    }
  };

  const handleTranslate = async () => {
    if (!videoUrl || !sourceLanguage || !targetLanguage) {
      setError('Please provide a valid video URL, select a source language and target language.');
      return;
    }
  
    // Store lipSync value in localStorage
    localStorage.setItem('lipSyncSelected', lipSync.toString());
  
    const payload = {
      url: videoUrl,
      language: targetLanguage,
      source_language: sourceLanguage,
      lipsync: lipSync,
      merge_interval: 1,
      face_enhance: true,
      webhookUrl: "https://dd9f-219-91-134-123.ngrok-free.app/api/webhook",
    };
  
    setError(null);
    setIsTranslating(true);
    setShowProcessingPopup(true);
  
    try {
      const response = await axios.post(
        'https://openapi.akool.com/api/open/v3/content/video/createbytranslate',
        payload,
        {
          headers: {
            Authorization: `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
  
      if (response.data.code === 1000) {
        setTranslationResult(null);
      } else {
        setError(response.data.msg || 'Failed to initiate translation.');
        setShowProcessingPopup(false);
      }
    } catch (err) {
      setError('An error occurred while translating the video.');
      setShowProcessingPopup(false);
      console.error(err);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleErrorClose = () => {
    setApiToken('');
    setLanguages([]);
    setSourceLanguage(null);
    setTargetLanguage(null);
    setVideoUrl('');
    setLipSync(false);
    setError(null);
  };

  useEffect(() => {
    if (processingVideoUrl) {
      setShowProcessingPopup(false);
    }
  }, [processingVideoUrl]);
  

  const isTranslateButtonDisabled = !videoUrl || !sourceLanguage || !targetLanguage;

  const handleErrorPopupClose = () => {
    setShowErrorPopup(false);
    setErrorMessage('');
  };

  const handleDownload = () => {
    if (processingVideoUrl) {
      // Create a temporary link element
      const a = document.createElement('a');
      a.href = processingVideoUrl;
      a.download = `translated-video-${Date.now()}.mp4`; // Add timestamp to prevent duplicate names
      
      // This will work because the video is already loaded in the video element
      // and the browser has already validated the CORS policy
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const handleTranslateAnother = () => {
    localStorage.removeItem('lipSyncSelected');
    setVideoUrl('');
    setSourceLanguage(null);
    setTargetLanguage(null);
    setLipSync(false);
    setError(null);
    setTranslationResult(null);
    setProcessingVideoUrl(null);
    setShowProcessingPopup(false);
    setShowErrorPopup(false);
    setErrorMessage('');
    setIsTranslating(false);
  };

  const fetchToken = async () => {
    if (!clientId || !clientSecret) {
      setError('Please provide both Client ID and Client Secret');
      return;
    }

    setIsTokenLoading(true);
    setError(null);

    try {
      const response = await axios.post(
        'https://openapi.akool.com/api/open/v3/getToken',
        {
          clientId,
          clientSecret
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('Token API Response:', response.data);

      if (response.data.code === 1000) {
        if (response.data.token) {
          setApiToken(response.data.token);
          console.log('Token successfully set:', response.data.token);
        } else {
          setError('Token not found in response');
          console.error('Token missing from response:', response.data);
        }
      } else {
        setError(response.data.msg || 'Failed to fetch token');
        console.error('API Error:', response.data);
      }
    } catch (err: any) {
      console.error('Full error object:', err);
      
      if (err.response) {
        console.error('Error response:', {
          data: err.response.data,
          status: err.response.status,
          headers: err.response.headers
        });
        setError(`Error: ${err.response.data.msg || 'Server error'}`);
      } else if (err.request) {
        console.error('Error request:', err.request);
        setError('No response received from server');
      } else {
        console.error('Error message:', err.message);
        setError(`Error: ${err.message}`);
      }
    } finally {
      setIsTokenLoading(false);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="logo">
          <img src="/images/4p6vr8j7vbom4axo7k0 2.png" alt="AI Video Translator Logo" className="logo-img" />
          <h1>AI Video Translator</h1>
        </div>
      </header>
      <main>
        {!apiToken && (
          <div className="auth-container">
            <div className="auth-tabs">
              <button 
                className={`auth-tab ${authMethod === 'credentials' ? 'active' : ''}`}
                onClick={() => setAuthMethod('credentials')}
              >
                Client Credentials
              </button>
              <button 
                className={`auth-tab ${authMethod === 'token' ? 'active' : ''}`}
                onClick={() => setAuthMethod('token')}
              >
                API Token
              </button>
            </div>

            <div className="auth-content">
              {authMethod === 'credentials' && (
                <div className="credentials-form">
                  <div className="input-group">
                    <label>Client ID</label>
                    <input
                      type="text"
                      placeholder="Enter your Client ID"
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                    />
                  </div>
                  <div className="input-group">
                    <label>Client Secret</label>
                    <input
                      type="password"
                      placeholder="Enter your Client Secret"
                      value={clientSecret}
                      onChange={(e) => setClientSecret(e.target.value)}
                    />
                  </div>
                  <button 
                    onClick={fetchToken}
                    disabled={isTokenLoading || !clientId || !clientSecret}
                    className="auth-button"
                  >
                    {isTokenLoading ? (
                      <>
                        <div className="spinner"></div>
                        <span>Fetching Token...</span>
                      </>
                    ) : (
                      'Get Token'
                    )}
                  </button>
                </div>
              )}

              {authMethod === 'token' && (
                <div className="token-form">
                  <div className="input-group">
                    <label>API Token</label>
                    <input
                      type="text"
                      placeholder="Enter your API Token"
                      value={tempToken}
                      onChange={(e) => setTempToken(e.target.value)}
                    />
                  </div>
                  <button 
                    onClick={() => {
                      if (tempToken) {
                        setApiToken(tempToken);
                        setFetchingLanguages(true);
                        fetchLanguages();
                      } else {
                        setError('Please enter an API token');
                      }
                    }}
                    className="auth-button"
                    disabled={!tempToken}
                  >
                    Submit Token
                  </button>
                </div>
              )}
            </div>

            {error && (
              <div className="error-message">
                <i className="fas fa-exclamation-circle"></i>
                <span>{error}</span>
              </div>
            )}
          </div>
        )}

        {apiToken && !processingVideoUrl && (
          <div className="main-content">
            {fetchingLanguages ? (
              <div className="loader"></div>
            ) : (
              <>
                <div className="language-selector">
                  <select
                    value={sourceLanguage || ''}
                    onChange={(e) => setSourceLanguage(e.target.value)}
                  >
                    <option value="">Select Source Language</option>
                    {languages.map((language) => (
                      <option key={language.lang_code} value={language.lang_code}>
                        {language.lang_name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={targetLanguage || ''}
                    onChange={(e) => setTargetLanguage(e.target.value)}
                  >
                    <option value="">Select Target Language</option>
                    {languages.map((language) => (
                      <option key={language.lang_code} value={language.lang_code}>
                        {language.lang_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="video-input">
                  <label>
                    Video URL:
                    <input
                      type="url"
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      placeholder="Enter video URL"
                    />
                  </label>
                </div>

                <div className="checkboxes">
                  <label className="lip-sync-checkbox">
                    <input
                      type="checkbox"
                      checked={lipSync}
                      onChange={() => setLipSync(!lipSync)}
                    />
                    <span className="checkbox-text">
                      <i className="fas fa-magic"></i> Enable Lip Sync
                    </span>
                  </label>
                </div>

                <div className="translate-button-container">
                  <button
                    onClick={handleTranslate}
                    disabled={isTranslateButtonDisabled}
                    className="translate-btn"
                  >
                    {isTranslating ? 'Translating...' : 'Translate'}
                  </button>
                </div>

                {/* <button onClick={async ()=>{
                  const d = await fetch('http://localhost:3007/test-app').then(r=>r.json())
                  console.log("Data",d)
                }}>
                  Test Socket Event
                </button> */}
                {error && <div className="error-message">{error}</div>}
                {translationResult}
              </>
            )}
          </div>
        )}

        {processingVideoUrl && (
          <div className="result-container">
            <div className="video-player">
              <video src={processingVideoUrl} controls></video>
            </div>
            <div className="action-buttons">
              <button 
                className="action-btn download-btn"
                onClick={handleDownload}
              >
                Download Video
              </button>
              <button 
                className="action-btn translate-another-btn"
                onClick={handleTranslateAnother}
              >
                Translate Another
              </button>
            </div>
          </div>
        )}

        {showProcessingPopup && (
          <div className="processing-popup-overlay">
            <div className="processing-popup">
              <p>Your video is being processed. Thank you for your patience</p>
              <div className="loader"></div>
            </div>
          </div>
        )}

        {showErrorPopup && (
          <div className="processing-popup-overlay">
            <div className="processing-popup error">
              <p>{errorMessage}</p>
              <button onClick={handleErrorPopupClose}>OK</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
