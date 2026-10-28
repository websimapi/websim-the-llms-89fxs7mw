// Enhance attribute tooltips and UI optimization for desktop
export function setupAttributeTooltips() {
    // Apply tooltips to attribute items
    document.querySelectorAll('.attribute-item').forEach(item => {
        const attributeName = item.querySelector('.attribute-name').textContent;
        const attributeDescription = item.querySelector('.attribute-description').textContent;
        
        // Create tooltip element
        const tooltip = document.createElement('div');
        tooltip.className = 'attribute-tooltip';
        tooltip.textContent = attributeDescription;
        
        // Add tooltip to item
        item.appendChild(tooltip);
    });
}

// Adjust UI height to prevent scrolling when possible
export function optimizeUIHeight() {
    const createLLMUI = document.getElementById('create-llm-ui');
    const sidebar = document.querySelector('.create-llm-sidebar');
    
    // Only run on desktop
    if (window.innerWidth <= 768) return;
    
    // Get all settings groups
    const settingsGroups = sidebar.querySelectorAll('.settings-group');
    
    // Check if we need to apply compact mode
    const sidebarHeight = sidebar.scrollHeight;
    const viewportHeight = window.innerHeight;
    
    if (sidebarHeight > viewportHeight) {
        createLLMUI.classList.add('compact-mode');
    } else {
        createLLMUI.classList.remove('compact-mode');
    }
    
    // Calculate optimal attribute grid layout based on available space
    optimizeAttributeGrid();
}

// New function to optimize attribute grid layout based on available space
function optimizeAttributeGrid() {
    const container = document.getElementById('attribute-grid');
    const settingsGroup = container.closest('.settings-group');
    const availableWidth = settingsGroup.clientWidth;
    
    // Determine optimal columns based on available width
    let columns = 3; // Default for large screens
    
    if (availableWidth < 400) {
        columns = 1;
    } else if (availableWidth < 650) {
        columns = 2;
    }
    
    // Apply column layout
    container.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
    
    // Adjust tooltip positions based on column layout
    document.querySelectorAll('.attribute-item').forEach((item, index) => {
        const tooltip = item.querySelector('.attribute-tooltip');
        if (!tooltip) return;
        
        // Reset position classes
        tooltip.classList.remove('tooltip-left', 'tooltip-right', 'tooltip-top');
        
        // For single column, place all tooltips to the right
        if (columns === 1) {
            tooltip.classList.add('tooltip-right');
        } 
        // For 2 columns, alternate between left and right
        else if (columns === 2) {
            if (index % 2 === 0) {
                tooltip.classList.add('tooltip-right');
            } else {
                tooltip.classList.add('tooltip-left');
            }
        } 
        // For 3+ columns, use left for rightmost column, right for others
        else {
            if ((index + 1) % columns === 0) {
                tooltip.classList.add('tooltip-left');
            } else {
                tooltip.classList.add('tooltip-right');
            }
        }
    });
}