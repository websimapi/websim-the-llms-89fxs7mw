// New file for custom confirmation modal logic
export function showConfirmationModal(message, onConfirm, onCancel) {
    const modal = document.getElementById('confirmation-modal');
    const messageElement = document.getElementById('confirmation-message');
    const confirmButton = document.getElementById('confirm-action-btn');
    const cancelButton = document.getElementById('cancel-action-btn');

    if (!modal || !messageElement || !confirmButton || !cancelButton) {
        console.error('Confirmation modal elements not found!');
        // Fallback to default confirm if UI elements are missing
        if (confirm(message)) {
            if (onConfirm) onConfirm();
        } else {
            if (onCancel) onCancel();
        }
        return;
    }

    // Set the message
    messageElement.textContent = message;

    // Store callbacks temporarily
    modal.onConfirm = onConfirm;
    modal.onCancel = onCancel;

    // Show the modal
    modal.classList.add('active');
}

function hideConfirmationModal() {
    const modal = document.getElementById('confirmation-modal');
    if (modal) {
        modal.classList.remove('active');
        // Clear callbacks
        modal.onConfirm = null;
        modal.onCancel = null;
    }
}

// Setup event listeners for the modal buttons
export function setupConfirmationModalListeners() {
    const confirmButton = document.getElementById('confirm-action-btn');
    const cancelButton = document.getElementById('cancel-action-btn');
    const modal = document.getElementById('confirmation-modal');

    if (confirmButton) {
        confirmButton.addEventListener('click', () => {
            if (modal && modal.onConfirm) {
                modal.onConfirm();
            }
            hideConfirmationModal();
        });
    }

    if (cancelButton) {
        cancelButton.addEventListener('click', () => {
            if (modal && modal.onCancel) {
                modal.onCancel();
            }
            hideConfirmationModal();
        });
    }

    // Optional: Add listener to close on clicking outside the modal content
    if (modal) {
        modal.addEventListener('click', (event) => {
             const modalContent = modal.querySelector('.confirmation-modal-content');
             if (modalContent && !modalContent.contains(event.target)) {
                 if (modal.onCancel) {
                     modal.onCancel(); // Treat outside click as cancel
                 }
                 hideConfirmationModal();
             }
        });
    }
}

// Initialize listeners when the DOM is ready
document.addEventListener('DOMContentLoaded', setupConfirmationModalListeners);