// New file for TTS voice selection functionality
import { getGlobalReferences } from './threeJSGlobals.js';

let availableVoices = [];
let selectedVoice = null;
let showAllLanguages = false;
let userLanguage = navigator.language || 'en-US';

// Initialize speech synthesis on first user interaction with the page
function initializeSpeechSynthesis() {
    const initUtterance = new SpeechSynthesisUtterance('');
    window.speechSynthesis.speak(initUtterance);
    window.speechSynthesis.cancel(); // Cancel immediately
}

// Initialize the TTS voice selector
export function setupTTSVoiceSelector() {
    // Create the UI elements for voice selection
    createVoiceSelectorUI();
    
    // Load available voices
    loadAvailableVoices();
    
    // Set up event listeners
    setupVoiceSelectionListeners();
}

// Create the UI elements for voice selection
function createVoiceSelectorUI() {
    // Find appearance settings group
    const appearanceSection = document.querySelector('.settings-group:nth-child(4)');
    if (!appearanceSection) return;
    
    // Check if voice selector already exists
    if (appearanceSection.querySelector('.tts-voice-selector')) return;
    
    // Create voice selector container
    const voiceSelectorContainer = document.createElement('div');
    voiceSelectorContainer.className = 'tts-voice-selector';
    
    // Add the HTML for the voice selector
    voiceSelectorContainer.innerHTML = `
        <div class="setting-item">
            <label class="setting-label" for="llm-tts-voice">Voice</label>
            <div class="voice-selection-container">
                <select id="llm-tts-voice" class="setting-select">
                    <option value="">Select a voice</option>
                    <!-- Voices will be populated here -->
                </select>
                <div class="show-all-languages">
                    <label class="setting-label show-all-label">
                        <input type="checkbox" id="show-all-languages" class="setting-checkbox">
                        All Languages
                    </label>
                </div>
            </div>
        </div>
    `;
    
    // Add to appearance section
    appearanceSection.appendChild(voiceSelectorContainer);
}

// Load available voices from the browser
function loadAvailableVoices() {
    // Get voices that are available right away
    let voices = window.speechSynthesis.getVoices();
    if (voices.length) {
        processVoices(voices);
    }
    
    // Also listen for the voiceschanged event in case voices load asynchronously
    window.speechSynthesis.onvoiceschanged = () => {
        voices = window.speechSynthesis.getVoices();
        processVoices(voices);
    };
}

// Process and display available voices
function processVoices(voices) {
    availableVoices = voices;
    updateVoiceList();
}

// Update the voice dropdown list based on language filter
function updateVoiceList() {
    const voiceSelect = document.getElementById('llm-tts-voice');
    if (!voiceSelect) return;
    
    // Clear current options (except the first one)
    while (voiceSelect.options.length > 1) {
        voiceSelect.remove(1);
    }
    
    // Filter voices by language if needed
    const filteredVoices = showAllLanguages 
        ? availableVoices 
        : availableVoices.filter(voice => {
            // Keep voices that match user's language or dialect
            return voice.lang.startsWith(userLanguage.split('-')[0]);
        });
    
    // Sort voices by language and name
    filteredVoices.sort((a, b) => {
        if (a.lang !== b.lang) {
            return a.lang.localeCompare(b.lang);
        }
        return a.name.localeCompare(b.name);
    });
    
    // Add filtered voices to select element
    filteredVoices.forEach(voice => {
        const option = document.createElement('option');
        option.value = voice.voiceURI;
        option.textContent = `${voice.name} (${voice.lang})`;
        option.setAttribute('data-lang', voice.lang);
        voiceSelect.appendChild(option);
    });
    
    // Check if we have a stored voice to select
    const statusElement = document.getElementById('generation-status');
    if (statusElement && statusElement.dataset.selectedVoice) {
        // Find the option with this voice URI
        const voiceUri = statusElement.dataset.selectedVoice;
        for (let i = 0; i < voiceSelect.options.length; i++) {
            if (voiceSelect.options[i].value === voiceUri) {
                voiceSelect.selectedIndex = i;
                break;
            }
        }
    }
}

// Set up event listeners for voice selection
function setupVoiceSelectionListeners() {
    // Voice selection change
    const voiceSelect = document.getElementById('llm-tts-voice');
    if (voiceSelect) {
        // Initialize speech synthesis on first click
        voiceSelect.addEventListener('mousedown', function() {
            // Only initialize once
            if (!window.speechSynthesisInitialized) {
                initializeSpeechSynthesis();
                window.speechSynthesisInitialized = true;
            }
        }, { once: true });
        
        voiceSelect.addEventListener('change', () => {
            const selectedVoiceUri = voiceSelect.value;
            if (selectedVoiceUri) {
                // Find the voice object
                selectedVoice = availableVoices.find(voice => voice.voiceURI === selectedVoiceUri);
                
                // Store selection in the status element for saving with the LLM
                const statusElement = document.getElementById('generation-status');
                if (statusElement) {
                    statusElement.dataset.selectedVoice = selectedVoiceUri;
                }
                
                // Automatically play a sample without needing to click test button
                speakSample();
            } else {
                selectedVoice = null;
            }
        });
    }
    
    // Show all languages toggle
    const showAllCheckbox = document.getElementById('show-all-languages');
    const showAllButton = document.querySelector('.show-all-languages');
    
    if (showAllCheckbox && showAllButton) {
        // Update button state based on checkbox state
        showAllButton.addEventListener('click', () => {
            if (showAllCheckbox) {
                showAllCheckbox.checked = !showAllCheckbox.checked;
                showAllLanguages = showAllCheckbox.checked;
                
                // Update button style
                if (showAllCheckbox.checked) {
                    showAllButton.classList.add('enabled');
                } else {
                    showAllButton.classList.remove('enabled');
                }
                
                updateVoiceList();
            }
        });
    }
}

// Speak a sample phrase using the selected voice
function speakSample() {
    if (!selectedVoice) return;
    
    // Get the LLM name or use a default
    const llmName = document.getElementById('llm-name').value || 'New LLM';
    
    // Create sample text based on LLM name and type
    const llmModel = document.getElementById('llm-model').value;
    let sampleText = `Hello, I'm ${llmName}, your new ${llmModel} LLM.`;
    
    // Create utterance with selected voice
    const utterance = new SpeechSynthesisUtterance(sampleText);
    utterance.voice = selectedVoice;
    utterance.rate = 1;
    utterance.pitch = 1;
    
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    
    // Speak the sample
    window.speechSynthesis.speak(utterance);
}

// Save and load TTS voice selection
export function saveTTSVoiceSelection(llmData) {
    const voiceSelect = document.getElementById('llm-tts-voice');
    if (voiceSelect && voiceSelect.value) {
        // Store voice details (URI, name, and language)
        const selectedIndex = voiceSelect.selectedIndex;
        if (selectedIndex > 0) {
            const voiceUri = voiceSelect.value;
            const voiceOption = voiceSelect.options[selectedIndex];
            llmData.voice = {
                uri: voiceUri,
                name: voiceOption.text.split(' (')[0],
                lang: voiceOption.getAttribute('data-lang')
            };
        }
    }
    return llmData;
}

export function loadTTSVoiceSelection(llm) {
    if (!llm || !llm.voice) return;
    
    // Initialize speech synthesis
    initializeSpeechSynthesis();
    window.speechSynthesisInitialized = true;
    
    // Wait for voices to be loaded
    function checkVoices() {
        if (availableVoices.length === 0) {
            // Try again in a moment
            setTimeout(checkVoices, 100);
            return;
        }
        
        // Set the selected voice in the dropdown
        const voiceSelect = document.getElementById('llm-tts-voice');
        if (voiceSelect) {
            for (let i = 0; i < voiceSelect.options.length; i++) {
                if (voiceSelect.options[i].value === llm.voice.uri) {
                    voiceSelect.selectedIndex = i;
                    selectedVoice = availableVoices.find(voice => voice.voiceURI === llm.voice.uri);
                    
                    // Store selection in the status element
                    const statusElement = document.getElementById('generation-status');
                    if (statusElement) {
                        statusElement.dataset.selectedVoice = llm.voice.uri;
                    }
                    break;
                }
            }
        }
    }
    
    checkVoices();
}