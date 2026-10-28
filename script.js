import { config } from './config.js';
import { cityData } from './cityData.js';
import * as THREE from 'three';
import { setupLLMCreationInterface } from './llmCreationInterface.js';
import { attributeSystem } from './attributeSystem.js';
import { llmDataManager } from './llmDataManager.js';
import { setupLLMCollectionView } from './llmCollectionView.js';
import { setupMusicPlayer, playTrack, fadeInMusic } from './musicPlayer.js'; 
import { marked } from 'marked'; 

let bgAudio;
let musicVolume;
let useLLMTips = localStorage.getItem('useLLMTips') !== null ? 
    localStorage.getItem('useLLMTips') === 'true' : true;
let tipFetchInterval;

document.addEventListener('DOMContentLoaded', () => {
    // Initialize LLM data manager
    if (typeof llmDataManager !== 'undefined') {
        llmDataManager.init();
    }

    // Setup music player UI
    setupMusicPlayer();

    const startOverlay = document.getElementById('start-overlay');
    const startButton = document.getElementById('start-button');
    const playButton = document.getElementById('play-button');
    const creditsButton = document.getElementById('credits-button'); 
    const creditsPanel = document.getElementById('credits-panel'); 
    const closeCreditsButton = creditsPanel.querySelector('.credits-close'); 
    const creditsContent = creditsPanel.querySelector('.credits-content'); 
    const loadingBar = document.querySelector('.loading-bar');
    const loadingPercentage = document.querySelector('.loading-percentage');
    const tipText = document.querySelector('.tip-text');
    const skipButton = document.getElementById('skip-button');
    const loadingScreen = document.getElementById('loading-screen');
    const gameContainer = document.getElementById('game-container');
    const loadingLLMToggle = document.getElementById('loading-llm-toggle');
    const startLLMToggle = document.getElementById('start-llm-toggle');
    
    // Hide loading screen initially
    loadingScreen.style.display = 'none';

    // Sync the toggle states
    loadingLLMToggle.checked = useLLMTips;
    startLLMToggle.checked = useLLMTips;

    // Toggle event listeners
    loadingLLMToggle.addEventListener('change', (e) => {
        useLLMTips = e.target.checked;
        localStorage.setItem('useLLMTips', useLLMTips);
        startLLMToggle.checked = useLLMTips;
        if (tipFetchInterval) {
            clearInterval(tipFetchInterval);
            if (useLLMTips) {
                startLLMTipFetch();
            } else {
                setRandomTip();
            }
        }
    });

    startLLMToggle.addEventListener('change', (e) => {
        useLLMTips = e.target.checked;
        localStorage.setItem('useLLMTips', useLLMTips);
        loadingLLMToggle.checked = useLLMTips;
    });

    // Add this new global variable to track where the user came from
    let createLLMOpenedFrom = 'plot'; // Default to plot view
    
    // Start experience button
    startButton.addEventListener('click', () => {
        startOverlay.style.display = 'none';
        loadingScreen.style.display = 'flex';
        // Ensure city music is set as the target and playing/fading in
        playTrack('city');
        startLoading();

        // Start the tip fetching based on toggle state
        if (useLLMTips) {
            startLLMTipFetch();
        } else {
            // Change tip every 3 seconds if using preset tips
            setInterval(setRandomTip, 3000);
        }
    });

    // Add play button click handler
    playButton.addEventListener('click', () => {
        startOverlay.style.display = 'none';
        loadingScreen.style.display = 'flex';
        // Ensure city music is set as the target and playing/fading in
        playTrack('city');
        startLoading();

        // Start the tip fetching based on toggle state
        if (useLLMTips) {
            startLLMTipFetch();
        } else {
            // Change tip every 3 seconds if using preset tips
            setInterval(setRandomTip, 3000);
        }
    });

    // Credits button click handler
    creditsButton.addEventListener('click', async () => {
        creditsContent.innerHTML = '<div class="loading-credits">Loading...</div>';
        creditsPanel.classList.remove('hidden');
        const creditsTitleElement = creditsPanel.querySelector('.credits-title'); // Get the title element
        creditsTitleElement.textContent = 'Credits'; // Default title while loading

        try {
            const response = await fetch('credits.md');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const markdown = await response.text();
            // Use DOMPurify if available, otherwise use marked directly (less secure)
            const html = (typeof DOMPurify !== 'undefined')
                ? DOMPurify.sanitize(await marked.parse(markdown))
                : await marked.parse(markdown);

            // Create a temporary div to parse the HTML and find the first H1
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;
            const firstH1 = tempDiv.querySelector('h1');

            if (firstH1) {
                // Use the H1 text as the panel title
                creditsTitleElement.textContent = firstH1.textContent;
                // Remove the H1 from the content to avoid duplication
                firstH1.remove();
                creditsContent.innerHTML = tempDiv.innerHTML; // Set content without the H1
            } else {
                // If no H1 found, just set the content
                creditsContent.innerHTML = html;
            }

        } catch (error) {
            console.error('Error loading or parsing credits:', error);
            creditsContent.innerHTML = '<p style="color: red;">Error loading credits.</p>';
            creditsTitleElement.textContent = 'Error'; // Update title on error
        }
    });

    // Close credits button click handler
    closeCreditsButton.addEventListener('click', () => {
        creditsPanel.classList.add('hidden');
    });


    // Skip button click handler
    skipButton.addEventListener('click', () => {
        clearInterval(loadingInterval);
        if (tipFetchInterval) {
            clearInterval(tipFetchInterval);
        }
        // Ensure city music continues playing when skipping
        playTrack('city'); // Use playTrack to handle volume correctly
        completeLoading();
    });

    // Function to complete loading and show game
    function completeLoading() {
        // Clear the tip fetch interval when loading completes
        if (tipFetchInterval) {
            clearInterval(tipFetchInterval);
        }
        loadingScreen.style.display = 'none';
        gameContainer.classList.remove('hidden');
        // Ensure city music continues playing (or starts if skipped very fast)
        playTrack('city'); // Use playTrack to handle volume correctly
    }

    // Randomly select a tip from config
    function setRandomTip() {
        const randomIndex = Math.floor(Math.random() * config.loadingTips.length);
        tipText.textContent = config.loadingTips[randomIndex];
    }

    // Fetch a random tip from LLM API
    async function fetchLLMTip() {
        try {
            const topics = [
                "virtual pets", "AI companions", "language models", "digital cities",
                "model training", "AI personalities", "token economics", "context windows",
                "prompt engineering", "fine-tuning", "hallucinations", "AI creativity",
                "neural networks", "LLM lifecycle", "model parameters", "AI city building"
            ];

            // Get 2-3 random topics to include in the prompt
            const randomTopics = [];
            const numTopics = Math.floor(Math.random() * 2) + 2; 

            while (randomTopics.length < numTopics) {
                const randomIndex = Math.floor(Math.random() * topics.length);
                const topic = topics[randomIndex];
                if (!randomTopics.includes(topic)) {
                    randomTopics.push(topic);
                }
            }

            const completion = await websim.chat.completions.create({
                messages: [
                    {
                        role: "system",
                        content: `Generate a single sentence tip about ${randomTopics.join(", ")} in the context of a simulation game called "The LLMs" where players manage AI entities in a virtual city. Keep it concise, fun and helpful for beginners. Respond with just the tip text, no additional formatting or explanation.`
                    }
                ]
            });

            return completion.content.trim();
        } catch (error) {
            console.error("Error fetching LLM tip:", error);
            return "LLMs sometimes need a moment to think!";
        }
    }

    // Start the LLM tip fetching cycle
    function startLLMTipFetch() {
        // Fetch first tip immediately
        if (useLLMTips) {
            fetchLLMTip().then(tip => {
                tipText.textContent = tip;
            });
        }

        // Set interval for fetching tips every 7 seconds
        tipFetchInterval = setInterval(() => {
            if (useLLMTips) {
                fetchLLMTip().then(tip => {
                    tipText.textContent = tip;
                });
            } else {
                setRandomTip();
            }
        }, 7000);
    }

    // Set initial tip based on toggle state
    if (useLLMTips) {
        // Don't start fetching until loading begins
    } else {
        setRandomTip();
    }

    let loadingInterval;

    // Start the loading process
    function startLoading() {
        // Simulate loading progress
        let progress = 0;
        const interval = 50; 
        const increment = (interval / config.loadingTime) * 100;

        loadingInterval = setInterval(() => {
            progress += increment;

            if (progress >= 100) {
                progress = 100;
                clearInterval(loadingInterval);

                // Show the game after a short delay
                setTimeout(completeLoading, 1000);
            }

            loadingBar.style.width = `${progress}%`;
            loadingPercentage.textContent = `${Math.round(progress)}%`;
        }, interval);

        // Removed audio event listeners here, handled by musicPlayer.js
    }

    function handleViewportResize() {
        const humanoidViewport = document.querySelector('.humanoid-viewport');
        if (humanoidViewport && window.humanoidCamera && window.humanoidRenderer) {
            const width = humanoidViewport.clientWidth;
            const height = humanoidViewport.clientHeight;

            window.humanoidCamera.aspect = width / height;
            window.humanoidCamera.updateProjectionMatrix();
            window.humanoidRenderer.setSize(width, height);
        }

        // Add call to optimize UI height on resize
        if (document.getElementById('create-llm-ui').classList.contains('active')) {
             import('./llmAttributeTooltips.js').then(module => module.optimizeUIHeight());
        }
    }

    window.addEventListener('resize', handleViewportResize);
});