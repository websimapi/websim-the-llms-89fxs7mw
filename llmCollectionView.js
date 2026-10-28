import { llmDataManager } from './llmDataManager.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createCustomCharacter } from './characterGenerator.js';
import { setupLLMViewInterface } from './llmViewInterface.js';
import { setupLLMCreationInterface } from './llmCreationInterface.js';
import { setupLLMCarousel, cleanupCarousel, selectModel, getSelectedModelId } from './llmCollectionCarousel.js';
import { activateDroneTransport, deactivateDroneTransport } from './llmDroneTransport.js';
import { hidePlotInfoPanel } from './plotHoverInfo.js';
import { showConfirmationModal } from './confirmationModal.js';
import { playTrack } from './musicPlayer.js'; 

let collectionAnimationId;

export function getModelTypeIcon(modelType) {
    switch(modelType) {
        case 'assistant':
            return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path d="M19 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h4l3 3 3-3h4c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 16h-4.83l-1.17 1.17-1.17-1.17H5V4h14v14z"/>
                <path d="M11 15h2v2h-2zm0-8h2v6h-2z"/>
            </svg>`;
        case 'creator':
            return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path d="M7 14c-1.66 0-3 1.34-3 3 0 1.31-1.16 2-2 2 .92 1.22 2.49 2 4 2 2.21 0 4-1.79 4-4 0-1.66-1.34-3-3-3zm13.71-9.37l-1.34-1.34a.996.996 0 0 0-1.41 0L9 12.25 11.75 15l8.96-8.96a.996.996 0 0 0 0-1.41z"/>
            </svg>`;
        case 'researcher':
            return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path d="M9.5 16c-1.93 0-3.5-1.57-3.5-3.5S7.57 9 9.5 9s3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5zm5.5-1l5 5-1.5 1.5-5-5V15l-0.03-0.03c-1.45 1.28-3.36 2.03-5.47 2.03-4.56 0-8.25-3.69-8.25-8.25s3.69-8.25 8.25-8.25S17 4.19 17 8.75c0 2.11-0.76 4.02-2.05 5.47L15 14.24z"/>
            </svg>`;
        case 'companion':
            return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8 0-.29.02-.58.05-.86 2.36-1.05 4.23-2.98 5.21-5.37C11.07 8.33 14.05 10 17.42 10c.78 0 1.53-.09 2.25-.26.21.71.33 1.47.33 2.26 0 4.41-3.59 8-8 8z"/>
            </svg>`;
        case 'humanoid':
            return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path d="M12,2C9.8,2,8,3.8,8,6c0,1.1,0.4,2.1,1.2,2.8C7.3,9.5,6,11.4,6,13.5V16c0,1.1,0.9,2,2,2h1v3c0,0.6,0.4,1,1,1h6c0.6,0,1-0.4,1-1v-3h1c1.1,0,2-0.9,2-2v-2.5c0-2.1-1.3-4-3.2-4.7C17.6,8.1,18,7.1,18,6C18,3.8,16.2,2,14,2H12z M12,4h2c1.1,0,2,0.9,2,2s-0.9,2-2,2h-2C10.9,8,10,7.1,10,6S10.9,4,12,4z M9,13.5c0-1.4,1.1-2.5,2.5-2.5h3c1.4,0,2.5,1.1,2.5,2.5V16H9V13.5z"/>
            </svg>`;
        default:
            return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>`;
    }
}

export function setupLLMCollectionView(selectLLMId = null) {
    llmDataManager.init();
    hidePlotInfoPanel();

    playTrack('creation'); 

    const collectionUI = document.getElementById('llm-collection-ui');
    collectionUI.classList.add('active');

    const collectionHeader = collectionUI.querySelector('.collection-header');

    setTimeout(() => {
        const collectionViewport = document.querySelector('.collection-viewport');
        const llmList = document.getElementById('llm-list');

        llmList.innerHTML = '';
        collectionViewport.innerHTML = '';

        if (collectionAnimationId) {
            cancelAnimationFrame(collectionAnimationId);
        }

        cleanupCarousel();

        const llms = llmDataManager.getAllLLMs();

        if (llms.length === 0) {
            llmList.innerHTML = `
                <div class="empty-collection">
                    <h3>No LLMs Created Yet</h3>
                    <p>Create your first LLM by clicking the "Create New LLM" button below.</p>
                </div>
            `;
        } else {
            llms.forEach((llm, index) => {
                const llmItem = document.createElement('div');
                llmItem.className = `llm-list-item ${llm.model}`;
                llmItem.setAttribute('data-id', llm.id);
                llmItem.innerHTML = `
                    <div class="llm-info">
                        <div style="display: flex; align-items: center;">
                            <div class="llm-model-icon">
                                ${getModelTypeIcon(llm.model)}
                            </div>
                            <h3>${llm.name}</h3>
                        </div>
                        <p class="llm-type">${llm.model}</p>
                        <p class="llm-created">Created: ${new Date(llm.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div class="llm-actions">
                        <button class="llm-edit-btn" data-id="${llm.id}">Edit</button>
                        <button class="llm-delete-btn" data-id="${llm.id}">Delete</button>
                    </div>
                `;
                llmList.appendChild(llmItem);

                llmItem.addEventListener('click', (e) => {
                    if (e.target.tagName !== 'BUTTON') {
                        const id = llmItem.getAttribute('data-id');
                        selectModel(id);

                        const editSelectedBtn = document.getElementById('edit-selected-llm-btn');
                        if (editSelectedBtn) {
                            editSelectedBtn.disabled = !id;
                        }
                    }
                });
            });

            const createNewItem = document.createElement('div');
            createNewItem.className = 'llm-list-item create-new-item';
            createNewItem.innerHTML = `
                <div class="llm-info">
                    <div style="display: flex; align-items: center;">
                        <div class="llm-model-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                            </svg>
                        </div>
                        <h3>Create New LLM</h3>
                    </div>
                </div>
            `;
            llmList.appendChild(createNewItem);

            createNewItem.addEventListener('click', () => {
                if (window.droneActive) {
                    showConfirmationModal(
                        "Cancel drone transport to create a new LLM?",
                        () => { 
                            deactivateDroneTransport(true);
                            openCreateLLMFromCollection();
                        },
                        () => { 
                            console.log("Create LLM action cancelled due to active drone transport.");
                        }
                    );
                } else {
                    openCreateLLMFromCollection();
                }
            });

            if (collectionHeader) {
                addTransportButton(collectionHeader); 
            }

            setupLLMCarousel(collectionViewport, llms);

            import('./llmProfileImageDisplay.js').then(module => {
                if (typeof module.addProfileImagesToLLMList === 'function') {
                    module.addProfileImagesToLLMList();
                } else {
                    console.error('addProfileImagesToLLMList function not found in module');
                }
            }).catch(error => {
                console.error('Error importing llmProfileImageDisplay module:', error);
            });

            collectionViewport.addEventListener('click', handleViewportClick);

            document.querySelectorAll('.llm-edit-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.target.getAttribute('data-id');
                    if (window.droneActive) {
                        showConfirmationModal(
                            "Cancel drone transport to edit this LLM?",
                            () => { 
                                deactivateDroneTransport(true);
                                handleEditLLM(id);
                            },
                            () => { 
                                console.log("Edit LLM action cancelled due to active drone transport.");
                            }
                        );
                    } else {
                        handleEditLLM(id);
                    }
                });
            });

            document.querySelectorAll('.llm-delete-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.target.getAttribute('data-id');
                    deleteLLM(id);
                });
            });

            if (selectLLMId) {
                selectModel(selectLLMId);
            } else if (llms.length > 0) {
                selectModel(llms[0].id);
            }
        }
    }, 100);

    const closeButton = document.querySelector('.collection-close');
    if (closeButton && closeButton.closest('#llm-collection-ui')) {
        const newCloseButton = closeButton.cloneNode(true);
        closeButton.parentNode.replaceChild(newCloseButton, closeButton);

        newCloseButton.addEventListener('click', () => {
            if (window.droneActive) {
                showConfirmationModal(
                    "Cancel drone transport to close the collection?",
                    () => { 
                        deactivateDroneTransport(true);
                        closeCollectionView();
                    },
                    () => { 
                        console.log("Close collection action cancelled due to active drone transport.");
                    }
                );
            } else {
                closeCollectionView();
            }
        });
    }
}

function openCreateLLMFromCollection() {
    document.getElementById('llm-collection-ui').classList.remove('active');
    document.getElementById('create-llm-ui').classList.add('active');
    window.createLLMOpenedFrom = 'collection';
    setupLLMCreationInterface();
    cleanupCarousel();
}

function closeCollectionView() {
    document.getElementById('llm-collection-ui').classList.remove('active');
    cleanupCarousel();
    window.createLLMOpenedFrom = 'plot'; 
    hidePlotInfoPanel();
    playTrack('city'); 
}

function addTransportButton(headerElement) { 
    const existingButton = document.querySelector('.transport-button-container');
    if (existingButton) {
        existingButton.remove();
    }

    const transportButtonContainer = document.createElement('div');
    transportButtonContainer.className = 'transport-button-container';

    transportButtonContainer.innerHTML = `
        <button class="transport-button" title="Transport Selected LLM to Plot">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="2" />
                <rect x="6.5" y="11.5" width="11" height="1" rx="0.5" />
                <rect x="11.5" y="7" width="1" height="11" rx="0.5" />
                <g class="propeller" style="transform-origin: 6.5px 11.5px;">
                    <circle cx="6.5" cy="11.5" r="1" />
                    <ellipse cx="6.5" cy="11.5" rx="3" ry="0.5" />
                    <ellipse cx="6.5" cy="11.5" rx="0.5" ry="3" />
                </g>
                <g class="propeller" style="transform-origin: 17.5px 11.5px;">
                    <circle cx="17.5" cy="11.5" r="1" />
                    <ellipse cx="17.5" cy="11.5" rx="3" ry="0.5" />
                    <ellipse cx="17.5" cy="11.5" rx="0.5" ry="3" />
                </g>
                <g class="propeller" style="transform-origin: 12px 7.5px;">
                    <circle cx="12" cy="7.5" r="1" />
                    <ellipse cx="12" cy="7.5" rx="3" ry="0.5" />
                    <ellipse cx="12" cy="7.5" rx="0.5" ry="3" />
                </g>
                <g class="propeller" style="transform-origin: 12px 17.5px;">
                    <circle cx="12" cy="17.5" r="1" />
                    <ellipse cx="12" cy="17.5" rx="3" ry="0.5" />
                    <ellipse cx="12" cy="17.5" rx="0.5" ry="3" />
                </g>
                <rect x="9" y="20" width="6" height="3" rx="1" />
                <path d="M10,20.5h4v0.5H10V20.5z" />
                <path d="M10,21.5h4v0.5H10V21.5z" />
                <path d="M10.5,20.75h1v1.5h-1V20.75z" />
                <path d="M12.5,20.75h1v1.5h-1V20.75z" />
            </svg>
        </button>
    `;

    transportButtonContainer.querySelector('.transport-button').addEventListener('click', () => {
        const selectedModelId = getSelectedModelId();
        if (selectedModelId) {
            document.getElementById('llm-collection-ui').classList.remove('active');
            cleanupCarousel();
            playTrack('city'); 
            activateDroneTransport(selectedModelId);
        } else {
            alert('Please select an LLM to transport');
        }
    });

    const closeButton = headerElement.querySelector('.collection-close');
    if (closeButton) {
        headerElement.insertBefore(transportButtonContainer, closeButton);
    } else {
        headerElement.appendChild(transportButtonContainer); 
    }
}

function viewLLMDetails(id) {
    setupLLMViewInterface(id);
}

function handleEditLLM(id) {
    const llm = llmDataManager.getLLMById(id);
    if (!llm) return;
    
    hidePlotInfoPanel(); 

    document.getElementById('llm-collection-ui').classList.remove('active');
    
    const createUI = document.getElementById('create-llm-ui');
    createUI.classList.add('active');
    createUI.setAttribute('data-edit-mode', 'true');
    createUI.setAttribute('data-edit-id', id);
    
    setupLLMCreationInterface(llm);
    
    if (collectionAnimationId) {
        cancelAnimationFrame(collectionAnimationId);
    }
}

function handleViewportClick(event) {
    const renderer = document.querySelector('.collection-viewport canvas');
    if (!renderer || !window.carouselCamera || !window.carouselScene) return;
    
    const rect = renderer.getBoundingClientRect();
    const mouse = {
        x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
        y: -((event.clientY - rect.top) / rect.height) * 2 + 1
    };
    
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, window.carouselCamera);
    
    const intersects = raycaster.intersectObjects(window.carouselScene.children, true);
    
    if (intersects.length > 0) {
        let model = intersects[0].object;
        
        while (model && (!model.userData || !model.userData.id)) {
            model = model.parent;
            
            if (!model) break;
        }
        
        if (model && model.userData && model.userData.id) {
            selectModel(model.userData.id);
        }
    }
}

function deleteLLM(id) {
    showConfirmationModal(
        'Are you sure you want to delete this LLM? This action cannot be undone.',
        () => { 
            if (llmDataManager.deleteLLM(id)) {
                setupLLMCollectionView();
            }
        },
        () => { 
            console.log("Deletion cancelled.");
        }
    );
}