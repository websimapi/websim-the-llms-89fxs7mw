// LLM data storage and management
export const llmDataManager = {
    // Array to store all created LLMs
    createdLLMs: [],

    // Initialize from localStorage
    init() {
        const storedLLMs = localStorage.getItem('createdLLMs');
        if (storedLLMs) {
            try {
                this.createdLLMs = JSON.parse(storedLLMs);
                console.log(`Loaded ${this.createdLLMs.length} LLMs from localStorage.`);
            } catch (e) {
                console.error('Error loading LLMs from localStorage:', e);
                this.createdLLMs = [];
            }
        } else {
            console.log("No LLMs found in localStorage. Initializing empty collection.");
            this.createdLLMs = [];
        }
    },

    // Add a new LLM to the collection
    addLLM(llmData) {
        // Add a unique ID and creation timestamp
        llmData.id = Date.now() + Math.random().toString(36).substr(2, 9);
        llmData.createdAt = new Date().toISOString();

        // Add to array
        this.createdLLMs.push(llmData);

        // Save to localStorage
        this.saveToLocalStorage();
        console.log(`Added LLM: ${llmData.name} (ID: ${llmData.id})`);
        return llmData.id;
    },

    // Get all LLMs
    getAllLLMs() {
        return [...this.createdLLMs];
    },

    // Get specific LLM by ID
    getLLMById(id) {
        return this.createdLLMs.find(llm => llm.id === id);
    },

    // Delete an LLM by ID
    deleteLLM(id) {
        const index = this.createdLLMs.findIndex(llm => llm.id === id);
        if (index !== -1) {
            const deletedName = this.createdLLMs[index].name;
            this.createdLLMs.splice(index, 1);
            this.saveToLocalStorage();
            console.log(`Deleted LLM: ${deletedName} (ID: ${id})`);
            return true;
        }
        console.warn(`Could not delete LLM: ID ${id} not found.`);
        return false;
    },

    // Save all LLMs to localStorage
    saveToLocalStorage() {
        try {
            localStorage.setItem('createdLLMs', JSON.stringify(this.createdLLMs));
            console.log(`Saved ${this.createdLLMs.length} LLMs to localStorage.`);
        } catch (e) {
            console.error("Error saving LLMs to localStorage:", e);
            // Potentially handle quota exceeded errors here
        }
    },

    // Update an existing LLM
    updateLLM(llmData) {
        const index = this.createdLLMs.findIndex(llm => llm.id === llmData.id);
        if (index !== -1) {
            // Preserve creation timestamp
            llmData.createdAt = this.createdLLMs[index].createdAt;

            // Preserve profile image if not being updated
            if (!llmData.profileImageUrl && this.createdLLMs[index].profileImageUrl) {
                llmData.profileImageUrl = this.createdLLMs[index].profileImageUrl;
            }

            this.createdLLMs[index] = llmData;
            this.saveToLocalStorage();
            console.log(`Updated LLM: ${llmData.name} (ID: ${llmData.id})`);
            return true;
        }
        console.warn(`Could not update LLM: ID ${llmData.id} not found.`);
        return false;
    },

    // Add to city data export (no longer used for full export, but might be useful elsewhere)
    addToCityData(cityData) {
        if (!cityData.llms) {
            cityData.llms = [];
        }
        cityData.llms = [...this.createdLLMs];
    },

    // Import from city data (used by importer)
    importFromCityData(data) {
        // Validate incoming data structure
        if (data && Array.isArray(data.llms)) {
            this.createdLLMs = [...data.llms]; // Replace current LLMs
            this.saveToLocalStorage(); // Save imported data
            console.log(`Imported ${this.createdLLMs.length} LLMs from data.`);
            return true;
        } else {
            console.error("Invalid data structure for LLM import:", data);
            return false;
        }
    }
};