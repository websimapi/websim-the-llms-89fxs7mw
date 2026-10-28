// New file for displaying profile images in various UI locations
import { llmDataManager } from './llmDataManager.js';

// Add profile image display to the basic info section of the Create LLM UI
// Modified to accept llmToEdit for direct image loading during setup
export function setupProfileImageDisplay(llmToEdit = null) {
    // Find the name input to locate the target section
    const nameInput = document.getElementById('llm-name');
    if (!nameInput) return;
    const nameSettingItem = nameInput.closest('.setting-item');
    if (!nameSettingItem) return;
    const basicInfoGroup = nameSettingItem.closest('.settings-group');
    if (!basicInfoGroup) return;

    let profileImageElement;
    // Check if profile image display already exists (within the new layout wrapper)
    const existingLayout = basicInfoGroup.querySelector('.basic-info-layout');
    if (existingLayout) {
        profileImageElement = existingLayout.querySelector('.profile-image-display');
    } else {
        // Create the layout wrapper
        const layoutWrapper = document.createElement('div');
        layoutWrapper.className = 'basic-info-layout';

        // Create profile image display element
        profileImageElement = document.createElement('div');
        profileImageElement.className = 'profile-image-display';
        profileImageElement.innerHTML = `
            <div class="profile-image-container">
                <div class="profile-image-placeholder">No image</div>
                <img class="profile-image" src="" alt="Profile" style="display: none;">
            </div>
        `;

        // Append image display and name item to the wrapper
        layoutWrapper.appendChild(profileImageElement);
        layoutWrapper.appendChild(nameSettingItem); // Move the existing name item into the wrapper

        // Insert the wrapper before where the name item originally was (or just after title)
        const titleElement = basicInfoGroup.querySelector('.settings-group-title');
        if (titleElement) {
             basicInfoGroup.insertBefore(layoutWrapper, titleElement.nextSibling);
        } else {
             basicInfoGroup.insertBefore(layoutWrapper, basicInfoGroup.firstChild); // Fallback
        }
    }

    // Use llmToEdit directly if provided, otherwise assume creating new
    const imageUrl = llmToEdit?.profileImageUrl;
    updateProfileImageDisplay(imageUrl);


    // Listen for profile image changes (ensure listener isn't duplicated)
    document.removeEventListener('profileImageSaved', handleProfileImageSaved); // Remove previous listener if any
    document.addEventListener('profileImageSaved', handleProfileImageSaved);
}

// Handler for the custom event
function handleProfileImageSaved(e) {
    if (e.detail && e.detail.url) {
        updateProfileImageDisplay(e.detail.url);
    }
}

// Update the profile image display in the appearance section
export function updateProfileImageDisplay(imageUrl) {
    // Find elements within the basic info layout
    const layout = document.querySelector('.basic-info-layout');
    if (!layout) return;

    const placeholder = layout.querySelector('.profile-image-placeholder');
    const imageElement = layout.querySelector('.profile-image');

    if (placeholder && imageElement) {
        if (imageUrl) {
            placeholder.style.display = 'none';
            imageElement.src = imageUrl;
            imageElement.style.display = 'block';
        } else {
            // Show placeholder if no image URL
            placeholder.style.display = 'flex'; // Use flex to center text
            imageElement.src = '';
            imageElement.style.display = 'none';
        }
    } else {
        // Log error if elements are not found
        console.error("Could not find profile image display elements within .basic-info-layout");
    }
}

// Add profile images to LLM list items in the collection view
export function addProfileImagesToLLMList() {
    const llmListItems = document.querySelectorAll('.llm-list-item');

    llmListItems.forEach(item => {
        const id = item.getAttribute('data-id');
        if (!id) return;

        const llm = llmDataManager.getLLMById(id);

        // Remove existing image container if present
        const existingImageContainer = item.querySelector('.llm-list-image-container');
        if (existingImageContainer) {
            item.removeChild(existingImageContainer);
            item.classList.remove('with-image'); // Remove class if image is removed
        }

        // Always add image container now, whether there's an image or not
        item.classList.add('with-image');
        
        // Create image container and image element
        const imageContainer = document.createElement('div');
        imageContainer.className = 'llm-list-image-container';

        if (llm && llm.profileImageUrl) {
            // Add actual image if available
            const image = document.createElement('img');
            image.className = 'llm-list-image';
            image.src = llm.profileImageUrl;
            image.alt = llm.name;
            imageContainer.appendChild(image);
        } else {
            // Add placeholder with camera icon if no image
            const placeholder = document.createElement('div');
            placeholder.className = 'llm-list-image-placeholder';
            placeholder.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
                    <path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z" fill="currentColor"/>
                    <path d="M9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z" fill="currentColor"/>
                </svg>
            `;
            imageContainer.appendChild(placeholder);
            
            // Add click handler to open edit mode with camera focus
            imageContainer.classList.add('camera-placeholder');
            imageContainer.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent triggering parent click
                handleProfileImagePlaceholderClick(llm.id);
            });
        }

        // Get the llm-info element to insert before
        const llmInfo = item.querySelector('.llm-info');
        if (llmInfo) {
            // Insert at the beginning of the item (before llm-info)
            item.insertBefore(imageContainer, llmInfo);
        } else {
            // Fallback - insert at the beginning of the item
            item.insertBefore(imageContainer, item.firstChild);
        }
    });
}

// Handle clicking on a placeholder image
function handleProfileImagePlaceholderClick(llmId) {
    const llm = llmDataManager.getLLMById(llmId);
    if (!llm) return;
    
    // Close the collection UI
    document.getElementById('llm-collection-ui').classList.remove('active');
    
    // Open the creation UI in edit mode
    const createUI = document.getElementById('create-llm-ui');
    createUI.classList.add('active');
    createUI.setAttribute('data-edit-mode', 'true');
    createUI.setAttribute('data-edit-id', llmId);
    
    // Set up the creation interface with the LLM data
    import('./llmCreationInterface.js').then(module => {
        module.setupLLMCreationInterface(llm);
        
        // Trigger camera button click after a short delay to allow UI to initialize
        setTimeout(() => {
            const cameraButton = document.getElementById('capture-profile-image');
            if (cameraButton) {
                cameraButton.click();
            }
        }, 500);
    });
}