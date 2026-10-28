// New file for city scene UI interactions
import { toggleConsolePanel } from './cityScene.js';
import { hidePlotInfoPanel } from './plotHoverInfo.js'; // Import the hide function
import { showConfirmationModal } from './confirmationModal.js';
import { deactivateDroneTransport } from './llmDroneTransport.js'; // Import drone deactivation
import { cityData } from './cityData.js'; // Import cityData for plot state
import { llmDataManager } from './llmDataManager.js'; // Import LLM data manager

// Setup UI interactions for the city scene
export function setupUIInteractions() {
    setupMenuButtons();
    setupConsoleToggle();
    setupCameraControls();
    // Removed setupConsolePanel call from here as it's called in cityScene.js after UI elements are guaranteed to exist
}

function setupMenuButtons() {
    const createLLMButton = document.querySelector('.create-llm-btn');
    const moveLLMButton = document.querySelector('.move-llm-btn');
    const assetsUIButton = document.querySelector('.assets-ui-btn'); // New button

    if (createLLMButton) {
        createLLMButton.addEventListener('click', () => {
            if (window.droneActive) {
                showConfirmationModal(
                    "Cancel drone transport to create a new LLM?",
                    () => { // onConfirm
                        deactivateDroneTransport(true);
                        openCreateLLMUI();
                    },
                    () => { // onCancel
                        console.log("Create LLM action cancelled due to active drone transport.");
                    }
                );
            } else {
                openCreateLLMUI();
            }
        });
    }

    if (moveLLMButton) {
        moveLLMButton.addEventListener('click', () => {
             if (window.droneActive) {
                showConfirmationModal(
                    "Cancel drone transport to manage LLMs?",
                    () => { // onConfirm
                        deactivateDroneTransport(true);
                        openCollectionViewUI();
                    },
                    () => { // onCancel
                        console.log("Manage LLMs action cancelled due to active drone transport.");
                    }
                );
            } else {
                openCollectionViewUI();
            }
        });
    }

    // Add listener for the new Assets UI button
    if (assetsUIButton) {
        assetsUIButton.addEventListener('click', () => {
            if (window.droneActive) {
                showConfirmationModal(
                    "Cancel drone transport to open the Assets UI?",
                    () => { // onConfirm
                        deactivateDroneTransport(true);
                        openAssetsUI();
                    },
                    () => { // onCancel
                        console.log("Assets UI action cancelled due to active drone transport.");
                    }
                );
            } else {
                openAssetsUI();
            }
        });
    }
}

// Helper function to open Create LLM UI
function openCreateLLMUI() {
    console.log('Opening Create LLM UI');
    hidePlotInfoPanel(); // Hide plot info when opening menu
    document.getElementById('create-llm-ui').classList.add('active');
    // Set global variable to track that create LLM was opened from plot view
    window.createLLMOpenedFrom = 'plot';

    // Import and setup LLM creation interface
    import('./llmCreationInterface.js').then(module => {
        module.setupLLMCreationInterface();
    }).catch(err => console.error("Error loading create LLM interface:", err));
}

// Helper function to open Collection View UI
function openCollectionViewUI() {
    console.log('Opening Collection View UI');
    hidePlotInfoPanel(); // Hide plot info when opening menu

    // Import and setup LLM collection view
    import('./llmCollectionView.js').then(module => {
        module.setupLLMCollectionView();
        document.getElementById('llm-collection-ui').classList.add('active');
    }).catch(err => console.error("Error loading collection view:", err));
}

// Helper function to open Assets UI
function openAssetsUI() {
    console.log('Opening Assets UI');
    hidePlotInfoPanel(); // Hide plot info when opening menu

    // Import and setup Assets UI
    import('./assetsUIManager.js').then(module => {
        module.openAssetsUI();
    }).catch(err => console.error("Error loading assets UI:", err));
}

// Setup console toggle key listener
export function setupConsoleToggle() {
    document.addEventListener('keydown', (event) => {
        // Prevent console toggle if an input field is focused
        if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
            return;
        }
        if (event.key === '`' || event.key === '~') {
            toggleConsolePanel();
        }
    });
}

// Setup additional camera controls
function setupCameraControls() {
    // Add keyboard controls for camera
    document.addEventListener('keydown', (event) => {
        // You can add keyboard shortcuts for camera movement here
        // For example: WASD keys for panning
    });
}

// Setup console panel functionality
export function setupConsolePanel() {
    const consolePanel = document.getElementById('console-panel');
    const closeButton = consolePanel.querySelector('.console-close');
    const exportButton = document.getElementById('export-data');
    const importButton = document.getElementById('import-data');
    const gridToggleButton = document.getElementById('toggle-grid'); // Ensure this button exists or is handled

    if (closeButton) {
        closeButton.addEventListener('click', () => {
            consolePanel.classList.add('hidden');
        });
    }

    // Only add grid toggle listener if the button exists
    if (gridToggleButton) {
         gridToggleButton.removeEventListener('click', toggleGridHandler); // Clean up previous listener
         gridToggleButton.addEventListener('click', toggleGridHandler);
    }

    // Setup data export/import functionality
    setupDataExportImport(exportButton, importButton, consolePanel); // Pass consolePanel
}


function toggleGridHandler() {
     if (window.cityGrid) {
         window.cityGrid.visible = !window.cityGrid.visible;
         logToConsole(`Grid ${window.cityGrid.visible ? 'shown' : 'hidden'}`);
     } else {
         logToConsole('Grid not available');
     }
 }

// Log messages to the in-game console
function logToConsole(message) {
    const consoleContent = document.querySelector('#console-panel .console-content');
    if (consoleContent) {
        const timestamp = new Date().toLocaleTimeString();
        consoleContent.innerHTML += `<p>[${timestamp}] ${message}</p>`;
        consoleContent.scrollTop = consoleContent.scrollHeight; // Scroll to bottom
    }
    console.log(message); // Also log to browser console
}

function setupDataExportImport(exportButton, importButton, consolePanel) {
    if (exportButton) {
        exportButton.addEventListener('click', () => {
            try {
                logToConsole("Starting data export...");
                // 1. Get LLM data from localStorage (via llmDataManager)
                const llms = llmDataManager.getAllLLMs();

                // 2. Get plot state data from cityData (occupants, availability etc.)
                // Create a serializable version of cityData.lots
                const plotStates = cityData.lots.map(lot => ({
                    id: lot.id,
                    available: lot.available,
                    occupants: lot.occupants || [] // Ensure occupants array exists
                }));

                // 3. Combine into a single export object
                const exportData = {
                    version: 1, // Add a version number for future compatibility
                    exportedAt: new Date().toISOString(),
                    llms: llms,
                    plotStates: plotStates,
                    // Add other relevant game state here if needed in the future
                };

                // 4. Convert to JSON string
                const jsonData = JSON.stringify(exportData, null, 2); // Pretty print JSON

                // 5. Create downloadable file
                const blob = new Blob([jsonData], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                // Use city name in the filename if available, otherwise default
                const cityName = cityData.name ? cityData.name.replace(/\s+/g, '_') : 'promptopia';
                a.download = `${cityName}_save_${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(a);
                a.click();

                // 6. Clean up
                setTimeout(() => {
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                    logToConsole("Data export successful!");
                }, 100);

            } catch (error) {
                console.error("Error during data export:", error);
                logToConsole(`Error exporting data: ${error.message}`);
            }
        });
    }

    if (importButton) {
        importButton.addEventListener('click', () => {
            logToConsole("Initiating data import...");
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';

            input.onchange = e => {
                const file = e.target.files[0];
                if (!file) {
                    logToConsole("Import cancelled: No file selected.");
                    return;
                }

                logToConsole(`Selected file: ${file.name}`);
                const reader = new FileReader();

                reader.onload = event => {
                    try {
                        const importedData = JSON.parse(event.target.result);
                        logToConsole("File read successfully. Validating data...");

                        // Basic validation
                        if (!importedData || typeof importedData !== 'object' || !Array.isArray(importedData.llms) || !Array.isArray(importedData.plotStates)) {
                             throw new Error("Invalid save file format.");
                        }

                        // Ask for confirmation before overwriting
                         showConfirmationModal(
                             "Importing this file will overwrite your current city and LLMs. Are you sure you want to proceed?",
                             () => { // onConfirm
                                 try {
                                     logToConsole("Import confirmed. Applying data...");
                                     // 1. Update LLM Data
                                     llmDataManager.importFromCityData({ llms: importedData.llms }); // Use existing import method
                                     logToConsole(`Imported ${importedData.llms.length} LLMs.`);

                                     // 2. Update Plot States
                                     let updatedPlots = 0;
                                     importedData.plotStates.forEach(importedPlot => {
                                         const existingPlot = cityData.lots.find(lot => lot.id === importedPlot.id);
                                         if (existingPlot) {
                                             existingPlot.available = importedPlot.available;
                                             existingPlot.occupants = importedPlot.occupants || []; // Ensure array exists
                                             updatedPlots++;
                                         }
                                     });
                                     logToConsole(`Updated ${updatedPlots} plot states.`);

                                     // 3. Optional: Update other city data if included in export

                                     logToConsole("Import successful! Reloading the city...");
                                     // Reload the page to apply changes consistently
                                     // Use setTimeout to allow the console message to be visible briefly
                                     setTimeout(() => location.reload(), 1500);
                                 } catch (applyError) {
                                     console.error("Error applying imported data:", applyError);
                                     logToConsole(`Error applying imported data: ${applyError.message}`);
                                 }
                             },
                             () => { // onCancel
                                 logToConsole("Import cancelled by user.");
                             }
                         );

                    } catch (parseError) {
                        console.error("Error parsing import file:", parseError);
                        logToConsole(`Error importing data: ${parseError.message}`);
                    }
                };

                reader.onerror = () => {
                     console.error("Error reading file:", reader.error);
                     logToConsole(`Error reading file: ${reader.error}`);
                };

                reader.readAsText(file);
            };

            input.click();
        });
    }
}