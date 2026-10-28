// Music player functionality for The LLMs
import { config } from './config.js';

let bgAudio;
let musicVolume = 0; // 0-4 (OFF, 25%, 50%, 75%, 100%)
let musicPlayerInitialized = false;
// Updated paths to use MP3 files
const CITY_MUSIC_TRACK = '/LLMs Morning Oasis - Sonauto.mp3'; 
const CREATION_MUSIC_TRACK = '/The LLMs - Creation Awaits.mp3'; 
const EDGE_OF_TIME_TRACK = '/The LLMs - Edge Of Time.mp3'; // New track
let currentTrackType = 'city'; // 'city' or 'creation' or 'edge_of_time' or 'custom'
let targetTrackType = 'city'; // Track the intended state
let fadeInterval = null; // Track active fade interval
let customMusicSelected = false;

export function setupMusicPlayer() {
    // Create the music player UI
    createMusicPlayerUI();
    
    // Initialize audio if not already done
    initializeAudio();
    
    // Add event listeners
    setupEventListeners();
    
    // Create and setup toggle triangle
    createMusicToggle();
}

function createMusicPlayerUI() {
    // Create container
    const container = document.createElement('div');
    container.className = 'music-control-container';
    
    // Create toggle button with music note icon
    const toggleButton = document.createElement('button');
    toggleButton.className = 'music-toggle-button muted';
    toggleButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
        </svg>
    `;
    
    // Add volume indicator dots
    const volumeDots = document.createElement('div');
    volumeDots.className = 'volume-dots';
    
    // Add 4 volume dots
    for (let i = 0; i < 4; i++) {
        const dot = document.createElement('div');
        dot.className = 'volume-dot';
        dot.setAttribute('data-level', i);
        volumeDots.appendChild(dot);
    }
    
    toggleButton.appendChild(volumeDots);
    container.appendChild(toggleButton);
    
    // Create music selector menu (initially hidden)
    const musicMenu = document.createElement('div');
    musicMenu.className = 'music-menu hidden';
    musicMenu.innerHTML = `
        <div class="music-menu-header">Select Music</div>
        <div class="music-menu-options">
            <button class="music-option default-track" data-track-type="city">City Music</button>
            <button class="music-option creation-track" data-track-type="creation">Creation Music</button>
            <button class="music-option edge-of-time-track" data-track-type="edge_of_time">Edge Of Time Music</button>
            <label class="music-option custom-track">
                Custom Music
                <input type="file" accept="audio/*" class="custom-music-input">
            </label>
        </div>
    `;
    
    container.appendChild(musicMenu);
    
    // Add to body
    document.body.appendChild(container);
}

function initializeAudio() {
    // Check if already initialized in another module
    if (window.bgAudio) {
        bgAudio = window.bgAudio;
        musicPlayerInitialized = true;
        
        // Determine current track type based on src
        if (bgAudio.src.includes(CREATION_MUSIC_TRACK)) {
            currentTrackType = 'creation';
        } else if (bgAudio.src.includes(EDGE_OF_TIME_TRACK)) {
            currentTrackType = 'edge_of_time';
        } else {
            currentTrackType = 'city'; // Assume city or custom
        }
        targetTrackType = currentTrackType; // Initialize target

        // Set initial volume state based on audio element
        if (bgAudio.volume > 0) {
            if (bgAudio.volume <= 0.25) musicVolume = 1;
            else if (bgAudio.volume <= 0.50) musicVolume = 2;
            else if (bgAudio.volume <= 0.75) musicVolume = 3;
            else musicVolume = 4;
            
            updateVolumeUI();
        }
        return;
    }
    
    // Initialize new audio element with city music
    bgAudio = new Audio(CITY_MUSIC_TRACK);
    bgAudio.loop = true;
    bgAudio.volume = 0; // Start with volume at 0
    currentTrackType = 'city';
    targetTrackType = 'city';

    // Load saved volume from localStorage or use configured default
    const savedVolume = localStorage.getItem('musicVolume');
    if (savedVolume !== null) {
        musicVolume = parseInt(savedVolume);
    } else if (config.music && config.music.defaultVolume !== undefined) {
        musicVolume = config.music.defaultVolume;
    }
    
    // Don't auto-play, just update volume state UI
    updateVolumeUI();
    
    // Store it globally for other modules
    window.bgAudio = bgAudio;
    
    musicPlayerInitialized = true;
}

function setupEventListeners() {
    // Toggle button changes volume
    const toggleButton = document.querySelector('.music-toggle-button');
    toggleButton.addEventListener('click', changeVolumeState);
    
    // Context menu (right click) or long press opens music selector
    toggleButton.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        toggleMusicMenu();
    });
    
    // Long press for mobile
    let longPressTimer;
    toggleButton.addEventListener('touchstart', () => {
        longPressTimer = setTimeout(() => {
            toggleMusicMenu();
        }, 800); // 800ms for long press
    });
    
    toggleButton.addEventListener('touchend', () => {
        clearTimeout(longPressTimer);
    });
    
    // Default track selection
    const defaultTrackBtn = document.querySelector('.default-track');
    if (defaultTrackBtn) {
        defaultTrackBtn.addEventListener('click', () => {
            playTrack('city');
            customMusicSelected = false;
            toggleMusicMenu();
        });
    }

    // Creation track selection
    const creationTrackBtn = document.querySelector('.creation-track');
    if (creationTrackBtn) {
        creationTrackBtn.addEventListener('click', () => {
            playTrack('creation');
            customMusicSelected = false;
            toggleMusicMenu();
        });
    }
    
    // Edge of time track selection
    const edgeOfTimeTrackBtn = document.querySelector('.edge-of-time-track');
    if (edgeOfTimeTrackBtn) {
        edgeOfTimeTrackBtn.addEventListener('click', () => {
            playTrack('edge_of_time');
            customMusicSelected = false;
            toggleMusicMenu();
        });
    }
    
    // Custom track selection
    const customTrackInput = document.querySelector('.custom-music-input');
    if (customTrackInput) {
        customTrackInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                const file = e.target.files[0];
                const objectURL = URL.createObjectURL(file);
                playTrack('custom', objectURL);
                toggleMusicMenu();
                e.target.value = '';
            }
        });
    }
    
    // Click outside closes menu
    document.addEventListener('click', (e) => {
        const musicMenu = document.querySelector('.music-menu');
        const musicControls = document.querySelector('.music-control-container'); // Check container instead of just button

        if (musicMenu && !musicMenu.classList.contains('hidden') &&
            !musicMenu.contains(e.target) &&
            musicControls && !musicControls.contains(e.target)) { // Check if click is outside the entire control container
            musicMenu.classList.add('hidden');
        }
    });
}

function toggleMusicMenu() {
    const musicMenu = document.querySelector('.music-menu');
    musicMenu.classList.toggle('hidden');
}

function changeTrack(trackSrc, trackType) {
    // Stop current audio and clear fade interval
    if (bgAudio) {
        bgAudio.pause();
        bgAudio.removeAttribute('src'); // Remove source to help garbage collection
        bgAudio.load(); // Reset the audio element
    }
    if (fadeInterval) {
        clearInterval(fadeInterval);
        fadeInterval = null;
    }

    // Create new audio element
    bgAudio = new Audio(trackSrc);
    bgAudio.loop = true;
    bgAudio.volume = [0, 0.25, 0.5, 0.75, 1.0][musicVolume];

    // Update global reference and state
    window.bgAudio = bgAudio;
    currentTrackType = trackType;
    customMusicSelected = (trackType === 'custom');

    console.log(`Switched track to: ${trackSrc}, type: ${trackType}, volume: ${bgAudio.volume}`);

    // Start playback if volume is not 0
    if (bgAudio.volume > 0) {
        bgAudio.play().catch(err => {
            console.error("Error playing new audio track:", err);
        });
    }
    updateVolumeUI();
}

function changeVolumeState() {
    // Cycle through volume states
    musicVolume = (musicVolume + 1) % 5;
    updateVolumeState();
}

function updateVolumeState() {
    // Set volume on audio element
    let actualVolume = [0, 0.25, 0.5, 0.75, 1.0][musicVolume];
    
    // Stop fading if user manually changes volume
    if (fadeInterval) {
        clearInterval(fadeInterval);
        fadeInterval = null;
    }

    bgAudio.volume = actualVolume;
    
    // Start/stop playback based on volume
    if (actualVolume > 0 && bgAudio.paused) {
        bgAudio.play().catch(err => console.error("Error playing audio on volume change:", err));
    } else if (actualVolume === 0 && !bgAudio.paused) {
        bgAudio.pause();
    }

    localStorage.setItem('musicVolume', musicVolume);
    
    updateVolumeUI();
}

function updateVolumeUI() {
    const toggleButton = document.querySelector('.music-toggle-button');
    const volumeDots = document.querySelectorAll('.volume-dot');
    if (!toggleButton || !volumeDots) return; // Add guard clause
    
    toggleButton.classList.remove('muted', 'volume-25', 'volume-50', 'volume-75', 'volume-100', 'playing');
    
    if (musicVolume === 0) {
        toggleButton.classList.add('muted');
    } else {
        const volumeClass = ['muted', 'volume-25', 'volume-50', 'volume-75', 'volume-100'][musicVolume];
        toggleButton.classList.add(volumeClass);
        
        if (bgAudio && !bgAudio.paused) { // Check bgAudio exists
            toggleButton.classList.add('playing');
        }
    }
    
    volumeDots.forEach((dot, index) => {
        if (index < musicVolume) {
            dot.classList.add('active');
        } else {
            dot.classList.remove('active');
        }
    });
}

function createMusicToggle() {
    // Create toggle triangle
    const toggleTriangle = document.createElement('div');
    toggleTriangle.className = 'music-toggle-triangle';
    document.body.appendChild(toggleTriangle);
    
    // Add click handler
    toggleTriangle.addEventListener('click', () => {
        const musicControl = document.querySelector('.music-control-container');
        if (musicControl) {
            const isVisible = !musicControl.classList.contains('hidden');
            if (isVisible) {
                musicControl.classList.add('hidden');
                toggleTriangle.classList.add('hidden');
            } else {
                musicControl.classList.remove('hidden');
                toggleTriangle.classList.remove('hidden');
            }
        }
    });
}

/**
 * Plays the specified track type, fading out the current track if necessary.
 * @param {'city' | 'creation' | 'edge_of_time' | 'custom'} type - The type of track to play.
 * @param {string} [customSrc] - The source URL if type is 'custom'.
 */
export async function playTrack(type, customSrc = '') {
    targetTrackType = type;

    if (!bgAudio) initializeAudio(); // Ensure audio is initialized

    if (type === currentTrackType && !bgAudio.paused && bgAudio.volume > 0) {
        console.log(`Track type ${type} is already playing.`);
        // Ensure it's fully faded in if needed
        fadeInMusic(config.music.fadeInDuration / 2 || 1000); // Quick fade in if not already at target
        return;
    }
    
    // If the target is the same but the audio is paused or silent, just fade in
    if (type === currentTrackType && (bgAudio.paused || bgAudio.volume === 0)) {
        console.log(`Track type ${type} was selected but paused/silent. Fading in.`);
        fadeInMusic(config.music.fadeInDuration || 5000); // Use longer fade-in from config
        return;
    }

    const newTrackSrc = type === 'creation' ? CREATION_MUSIC_TRACK :
                       type === 'city' ? CITY_MUSIC_TRACK :
                       type === 'edge_of_time' ? EDGE_OF_TIME_TRACK :
                       type === 'custom' ? customSrc : CITY_MUSIC_TRACK;

    if (!newTrackSrc) {
        console.error("Invalid track type or missing custom source.");
        return;
    }

    console.log(`Request to play track type: ${type}. Current: ${currentTrackType}`);

    // Fade out current track only if it's playing and has volume
    if (!bgAudio.paused && bgAudio.volume > 0.01) {
        await fadeOutMusic(config.music.fadeOutDuration || 3000); // Use longer fade-out from config
    } else {
        // Ensure volume is 0 if paused or already silent
        bgAudio.volume = 0;
        updateVolumeUI();
    }

    // Check if target changed during fade-out
    if (targetTrackType !== type) {
         console.log(`Target track changed during fade-out. Aborting switch to ${type}.`);
         // Potentially start fading in the NEW target track here if needed
         // For now, just aborting.
         return;
     }

    changeTrack(newTrackSrc, type); // This sets bgAudio.volume based on musicVolume

    // Fade in the new track
    fadeInMusic(config.music.fadeInDuration || 5000); // Use longer fade-in from config
}

export function playMusic() {
    if (!bgAudio) initializeAudio();
    if (musicVolume > 0) {
        bgAudio.play().catch(err => {
            console.error("Error playing audio:", err);
        });
        updateVolumeUI();
    }
}

export function pauseMusic() {
    if (bgAudio) {
        bgAudio.pause();
        updateVolumeUI();
    }
}

export function fadeInMusic(duration = 5000) {
    if (!bgAudio || musicVolume === 0) {
        console.log("Cannot fade in: No audio or volume is 0.");
        return;
    }

    if (fadeInterval) {
        clearInterval(fadeInterval);
        fadeInterval = null;
    }

    const targetVolume = [0, 0.25, 0.5, 0.75, 1.0][musicVolume];
    // Always start fade from near zero for a more noticeable effect
    let startVolume = 0.01;

    // *** Check if already at or above target volume ***
    if (!bgAudio.paused && bgAudio.volume >= targetVolume) {
        console.log(`Fade-in skipped: Audio already playing at volume ${bgAudio.volume} (Target: ${targetVolume})`);
        // Ensure volume is exactly the target if it somehow went over
        bgAudio.volume = targetVolume;
        updateVolumeUI();
        return;
    }

    // If currently paused but volume is already close to target, just start playing
    if (bgAudio.paused && bgAudio.volume >= targetVolume * 0.9) {
         console.log(`Fade-in skipped: Audio paused but volume already near target (${bgAudio.volume}). Playing directly.`);
         bgAudio.volume = targetVolume; // Ensure exact target volume
         bgAudio.play().catch(err => {
             console.error("Error playing audio directly during fade-in check:", err);
             return;
         });
         updateVolumeUI();
         return;
    }

    // If volume is significantly lower, start fade from low volume
    bgAudio.volume = startVolume; // Set initial volume low for fade effect

    // Check if we actually need to fade in (target volume > start)
    if (targetVolume <= startVolume) {
        console.log("Fade-in skipped: Target volume not higher than start volume.");
        // If it's somehow already playing at a higher volume, just set to target
        if (!bgAudio.paused && bgAudio.volume > targetVolume) {
             bgAudio.volume = targetVolume;
             updateVolumeUI();
        }
        return;
    }


    bgAudio.play().catch(err => {
        console.error("Error playing audio during fade-in:", err);
        return;
    });
    console.log(`Fading in to volume ${targetVolume} from ${startVolume} over ${duration}ms`);

    if (duration === 0) {
        bgAudio.volume = targetVolume;
        updateVolumeUI();
        return;
    }

    const fadeSteps = 50;
    const volumeStep = (targetVolume - startVolume) / fadeSteps;
    const intervalTime = duration / fadeSteps;

    fadeInterval = setInterval(() => {
        // Check if the track *type* has changed, not just the target
        // Allow custom tracks to override always
        if (currentTrackType !== targetTrackType && currentTrackType !== 'custom') {
            console.log("Track type changed during fade-in. Stopping fade.");
            clearInterval(fadeInterval);
            fadeInterval = null;
            return;
        }

        let newVolume = bgAudio.volume + volumeStep;
        // Ensure we don't overshoot the target volume
        if ((volumeStep > 0 && newVolume < targetVolume) || (volumeStep < 0 && newVolume > targetVolume)) {
            bgAudio.volume = newVolume;
        } else {
            bgAudio.volume = targetVolume; // Clamp to target
            clearInterval(fadeInterval);
            fadeInterval = null;
            console.log("Fade-in complete.");
        }
        updateVolumeUI();
    }, intervalTime);

    updateVolumeUI(); // Update UI immediately after starting fade
}

export function fadeOutMusic(duration = 3000) {
    return new Promise(resolve => {
        if (!bgAudio || bgAudio.volume <= 0.01 || bgAudio.paused) {
            console.log("Fade-out skipped: Audio not playing or volume is near 0.");
            // Ensure audio is paused and volume is 0 if skipping
            if(bgAudio) {
                bgAudio.pause();
                bgAudio.volume = 0;
                updateVolumeUI();
            }
            resolve();
            return;
        }

        if (fadeInterval) {
            clearInterval(fadeInterval);
            fadeInterval = null;
        }
        console.log(`Fading out from volume ${bgAudio.volume} over ${duration}ms`);

        const startVolume = bgAudio.volume;
        const fadeSteps = 50;
        const volumeStep = startVolume / fadeSteps;
        const intervalTime = duration / fadeSteps;

        fadeInterval = setInterval(() => {
            let newVolume = bgAudio.volume - volumeStep;
            if (newVolume > 0.01) {
                bgAudio.volume = newVolume;
            } else {
                bgAudio.volume = 0;
                bgAudio.pause();
                clearInterval(fadeInterval);
                fadeInterval = null;
                console.log("Fade-out complete.");
                resolve();
            }
            updateVolumeUI();
        }, intervalTime);
        updateVolumeUI(); // Update UI immediately
    });
}