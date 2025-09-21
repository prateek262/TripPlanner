// Global variable to store the last generated itinerary data
let currentItineraryData = null;
let map = null; // Global map instance

// This function is called by the Google Maps script tag once it's loaded
function initMap() {
    console.log("Google Maps API loaded.");
}

document.addEventListener('DOMContentLoaded', () => {
    // --- Element Selectors ---
    const plannerForm = document.getElementById('plannerForm');
    const loadingDiv = document.getElementById('loading');
    const itineraryResultDiv = document.getElementById('itinerary-result');
    const postTripSection = document.getElementById('post-trip-section');
    const currencySelect = document.getElementById('currency');
    const languageSelect = document.getElementById('language');
    const generateBtn = document.getElementById('generate-btn');

    // Post-Trip Content Selectors
    const generateBlogBtn = document.getElementById('generate-blog-btn');
    const blogContentWrapper = document.getElementById('blog-content-wrapper');
    const blogContentDiv = document.getElementById('blog-content');
    const generateSocialBtn = document.getElementById('generate-social-btn');
    const socialContentWrapper = document.getElementById('social-content-wrapper');
    const socialContentDiv = document.getElementById('social-content');
    const generateMapBtn = document.getElementById('generate-map-btn');
    const mapContainer = document.getElementById('map-container');

    // --- Data Dictionaries ---
    const currencies = { "USD": "United States Dollar", "EUR": "Euro", "JPY": "Japanese Yen", "GBP": "British Pound Sterling", "INR": "Indian Rupee", "AUD": "Australian Dollar", "CAD": "Canadian Dollar", "CHF": "Swiss Franc", "CNY": "Chinese Yuan", "SEK": "Swedish Krona", "NZD": "New Zealand Dollar", "MXN": "Mexican Peso", "SGD": "Singapore Dollar", "HKD": "Hong Kong Dollar", "NOK": "Norwegian Krone", "KRW": "South Korean Won", "TRY": "Turkish Lira", "RUB": "Russian Ruble", "BRL": "Brazilian Real", "ZAR": "South African Rand", "AED": "UAE Dirham", "SAR": "Saudi Riyal" };
    const translations = {
        'English': { 'main-title': 'AI Personalized Trip Planner', 'subtitle': 'Craft your perfect journey, powered by AI.', 'destination-label': 'Destination', 'language-label': 'Language', 'budget-label': 'Total Budget', 'people-label': 'Number of People', 'days-label': 'Number of Days', 'interests-label': 'Interests (e.g., history, food, adventure)', 'generate-btn': 'Generate Itinerary' },
        'English-IN': { 'main-title': 'AI Personalized Trip Planner', 'subtitle': 'Craft your perfect journey, powered by AI.', 'destination-label': 'Destination', 'language-label': 'Language', 'budget-label': 'Total Budget', 'people-label': 'Number of People', 'days-label': 'Number of Days', 'interests-label': 'Interests (e.g., history, food, adventure)', 'generate-btn': 'Generate Itinerary' },
        'Hindi': { 'main-title': 'एआई व्यक्तिगत यात्रा योजनाकार', 'subtitle': 'एआई द्वारा संचालित, अपनी आदर्श यात्रा तैयार करें।', 'destination-label': 'गंतव्य', 'language-label': 'भाषा', 'budget-label': 'कुल बजट', 'people-label': 'लोगों की संख्या', 'days-label': 'दिनों की संख्या', 'interests-label': 'रुचियाँ (जैसे, इतिहास, भोजन, रोमांच)', 'generate-btn': 'यात्रा कार्यक्रम उत्पन्न करें' },
        'Spanish': { 'main-title': 'Planificador de Viajes Personalizado con IA', 'subtitle': 'Crea tu viaje perfecto, impulsado por IA.', 'destination-label': 'Destino', 'language-label': 'Idioma', 'budget-label': 'Presupuesto Total', 'people-label': 'Número de Personas', 'days-label': 'Número de Días', 'interests-label': 'Intereses (ej. historia, comida, aventura)', 'generate-btn': 'Generar Itinerario' },
    };

    // --- Initial Setup ---
    function populateCurrencies() {
        for (const code in currencies) {
            const option = document.createElement('option');
            option.value = code;
            option.textContent = `${code} - ${currencies[code]}`;
            if (code === 'USD') option.selected = true;
            currencySelect.appendChild(option);
        }
    }

    function updateLanguageUI() {
        const lang = languageSelect.value;
        const dict = translations[lang] || translations['English'];
        for (const id in dict) {
            const element = document.getElementById(id);
            if (element) {
                if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                    element.placeholder = dict[id];
                } else {
                    element.textContent = dict[id];
                }
            }
        }
    }
    
    populateCurrencies();
    updateLanguageUI();
    languageSelect.addEventListener('change', updateLanguageUI);

    // --- Main Itinerary Form Submission ---
    plannerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Reset UI state
        itineraryResultDiv.style.display = 'none';
        postTripSection.style.display = 'none';
        loadingDiv.style.display = 'block';
        generateBtn.disabled = true;
        generateBtn.textContent = 'Generating...';
        currentItineraryData = null;

        const formData = new FormData(plannerForm);
        const data = Object.fromEntries(formData.entries());

        try {
            const response = await fetch('/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            const result = await response.json();
            if (result.error) throw new Error(result.error);
            
            currentItineraryData = result; 
            displayItinerary(result); 
            itineraryResultDiv.style.display = 'block';
            postTripSection.style.display = 'block';

        } catch (error) {
            itineraryResultDiv.innerHTML = `<p style="color: red; text-align: center;"><b>Error:</b> ${error.message}</p>`;
            itineraryResultDiv.style.display = 'block';
        } finally {
            loadingDiv.style.display = 'none';
            generateBtn.disabled = false;
            updateLanguageUI(); // Restore original button text
        }
    });

    // --- Event Listener for Blog Generation ---
    generateBlogBtn.addEventListener('click', async () => {
        if (!currentItineraryData) return;
        blogContentWrapper.style.display = 'block';
        blogContentDiv.innerHTML = '<i>Generating your creative blog post...</i>';
        try {
            const response = await fetch('/generate-blog', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    itineraryData: currentItineraryData,
                    tone: document.getElementById('blog-tone').value,
                    language: document.getElementById('language').value,
                }),
            });
            const data = await response.json();
            if (data.error) throw new Error(data.error);
            blogContentDiv.innerHTML = data.blogPost
                .replace(/(\r\n|\n|\r)/gm, "<br>")
                .replace(/### (.*)/g, '<h3>$1</h3>')
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        } catch (error) {
            blogContentDiv.textContent = `Error: ${error.message}`;
        }
    });

    // --- Event Listener for Social Media Generation ---
    generateSocialBtn.addEventListener('click', async () => {
        if (!currentItineraryData) return;
        socialContentWrapper.style.display = 'block';
        socialContentDiv.innerHTML = '<i>Generating catchy social media captions...</i>';
        try {
            const response = await fetch('/generate-social', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    itineraryData: currentItineraryData,
                    language: document.getElementById('language').value,
                }),
            });
            const data = await response.json();
            if (data.error) throw new Error(data.error);
            socialContentDiv.innerHTML = data.socialContent
                .replace(/(\r\n|\n|\r)/gm, "<br>")
                .replace(/### (.*)/g, '<h3>$1</h3>')
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        } catch (error) {
            socialContentDiv.textContent = `Error: ${error.message}`;
        }
    });

    // --- Event Listener for Memory Map Generation ---
    generateMapBtn.addEventListener('click', () => {
        if (!currentItineraryData || typeof google === 'undefined') {
            mapContainer.textContent = "Itinerary data is not available or Google Maps has not loaded.";
            return;
        }
        mapContainer.style.display = 'block';
        mapContainer.innerHTML = ''; 
        const geocoder = new google.maps.Geocoder();
        const bounds = new google.maps.LatLngBounds();
        const infoWindow = new google.maps.InfoWindow();

        const map = new google.maps.Map(mapContainer, { zoom: 10, mapId: "TRIP_MAP" });

        const locationNames = new Set();
        const destinationName = currentItineraryData.tripTitle?.split(' in ')[1] || currentItineraryData.tripTitle;

        if (currentItineraryData.accommodationSuggestion?.name) {
            locationNames.add(`${currentItineraryData.accommodationSuggestion.name}, ${destinationName}`);
        }
        currentItineraryData.itinerary?.forEach(day => {
            day.activities?.forEach(activity => {
                locationNames.add(`${activity.activity}, ${destinationName}`);
            });
        });

        const locations = [];
        let processedCount = 0;
        
        if (locationNames.size === 0 && destinationName) {
            geocoder.geocode({ 'address': destinationName }, (results, status) => {
                if (status === 'OK' && results[0]) {
                    map.setCenter(results[0].geometry.location);
                }
            });
            return;
        }

        locationNames.forEach(address => {
            geocoder.geocode({ 'address': address }, (results, status) => {
                processedCount++;
                if (status === 'OK' && results[0]) {
                    const location = results[0].geometry.location;
                    locations.push(location);
                    bounds.extend(location);

                    const marker = new google.maps.Marker({
                        map: map,
                        position: location,
                        title: address,
                    });
                    
                    marker.addListener("click", () => {
                       infoWindow.setContent(address);
                       infoWindow.open(map, marker);
                    });
                }
                if (processedCount === locationNames.size) {
                    if (locations.length > 0) {
                        const flightPath = new google.maps.Polyline({
                            path: locations,
                            geodesic: true,
                            strokeColor: '#FF0000',
                            strokeOpacity: 1.0,
                            strokeWeight: 2,
                        });
                        flightPath.setMap(map);
                        map.fitBounds(bounds);
                    } else if (destinationName) { 
                        geocoder.geocode({ 'address': destinationName }, (results, status) => {
                            if (status === 'OK' && results[0]) {
                                map.setCenter(results[0].geometry.location);
                            }
                        });
                    }
                }
            });
        });
    });

    // --- Itinerary Display Function with Robustness ---
    function displayItinerary(data) {
        const formatCost = (cost) => (cost !== undefined && cost !== null ? cost.toLocaleString() : 'N/A');
        const symbol = data.currencyInfo?.symbol || '$';

        let html = `<h2>${data.tripTitle || 'Your Trip Itinerary'}</h2>`;
        html += `<p>${data.summary || 'A wonderful trip awaits!'}</p>`;
        html += `<p><strong>Total Estimated Cost:</strong> ${symbol}${formatCost(data.totalEstimatedCost)}</p>`;
        
        if (data.accommodationSuggestion && data.accommodationSuggestion.name) {
            html += `<h3>🏠 Accommodation Suggestion</h3>`;
            html += `<p>${data.accommodationSuggestion.name} (${data.accommodationSuggestion.type || 'Hotel'}) - Approx. ${symbol}${formatCost(data.accommodationSuggestion.estimatedCostPerNight)} per night.</p>`;
        }

        if (data.itinerary && Array.isArray(data.itinerary)) {
            data.itinerary.forEach(day => {
                if (!day) return; 
                html += `<div class="day-plan">`;
                html += `<h3>Day ${day.day || 'N/A'}: ${day.theme || 'Activities'} (Est: ${symbol}${formatCost(day.dailyTotalCost)})</h3>`;
                
                if (day.activities && Array.isArray(day.activities)) {
                    day.activities.forEach(act => {
                        if (!act) return;
                        html += `<p><strong>${act.time || 'All Day'} - ${act.activity || 'Experience'}:</strong> ${act.description || ''} (Cost: ${symbol}${formatCost(act.estimatedCost)})</p>`;
                    });
                }
                html += `</div>`;
            });
        }
        
        html += `<div class="button-container"><button id="export-pdf-btn">Export as PDF</button></div>`;
        itineraryResultDiv.innerHTML = html;
        
        document.getElementById('export-pdf-btn').addEventListener('click', () => exportItineraryAsPDF(data));
    }

    // --- PDF Export Function with Robustness ---
    function exportItineraryAsPDF(data) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        const formatCost = (cost) => (cost !== undefined && cost !== null ? cost.toLocaleString() : 'N/A');
        const symbol = data.currencyInfo?.symbol || '$';
        
        let y = 15;
        const pageHeight = doc.internal.pageSize.height;
        const margin = 10;
        
        function addText(text, x, isBold = false, size = 10) {
            if (y > pageHeight - margin) {
                doc.addPage();
                y = margin;
            }
            doc.setFont(undefined, isBold ? 'bold' : 'normal');
            doc.setFontSize(size);
            const splitText = doc.splitTextToSize(String(text), 180);
            doc.text(splitText, x, y);
            y += (splitText.length * (size / 2.5));
        }

        addText(data.tripTitle || 'Trip Itinerary', margin, true, 18);
        y += 5;
        addText(data.summary || '', margin);
        y += 5;
        const totalCostText = `Total Estimated Cost: ${symbol}${formatCost(data.totalEstimatedCost)}`;
        addText(totalCostText.replace(/₹/g, 'Rs.'), margin, true, 12);
        y += 10;

        if (data.accommodationSuggestion && data.accommodationSuggestion.name) {
            addText(`Accommodation: ${data.accommodationSuggestion.name} (${data.accommodationSuggestion.type || 'Hotel'})`, margin, true, 12);
            y += 5;
        }

        if (data.itinerary && Array.isArray(data.itinerary)) {
            data.itinerary.forEach(day => {
                if (!day) return;
                y += 5;
                const dayTitle = `Day ${day.day || 'N/A'}: ${day.theme || 'Activities'}`;
                addText(dayTitle, margin, true, 14);
                if (day.activities && Array.isArray(day.activities)) {
                    day.activities.forEach(act => {
                        if(!act) return;
                        const activityText = `${act.time || 'All Day'} - ${act.activity || 'Experience'} (Est: ${symbol}${formatCost(act.estimatedCost)}): ${act.description || ''}`;
                        addText(activityText.replace(/₹/g, 'Rs.'), margin + 5);
                        y += 2;
                    });
                }
            });
        }

        doc.save(`${(data.tripTitle || 'itinerary').replace(/\s+/g, '_')}.pdf`);
    }
});

