import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { countries } from '../data/countries';
import type { Country } from '../types';

// Fix Leaflet default marker icons
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface WorldMapProps {
  selectedCountry: Country | null;
  onCountrySelect: (country: Country) => void;
}

export function WorldMap({ selectedCountry, onCountrySelect }: WorldMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const [isMapReady, setIsMapReady] = useState(false);

  // Country coordinates (add more as needed)
  const countryCoordinates: Record<string, [number, number]> = {
    'BE': [50.8503, 4.3517], // Belgium
    'CL': [-35.6751, -71.5430], // Chile
    'ZA': [-30.5595, 22.9375], // South Africa
    'US': [37.0902, -95.7129], // United States
    'GB': [55.3781, -3.4360], // United Kingdom
    'DE': [51.1657, 10.4515], // Germany
    'FR': [46.2276, 2.2137], // France
    'JP': [36.2048, 138.2529], // Japan
    'AU': [-25.2744, 133.7751], // Australia
    'BR': [-14.2350, -51.9253], // Brazil
    'IN': [20.5937, 78.9629], // India
    'CN': [35.8617, 104.1954], // China
    'RU': [61.5240, 105.3188], // Russia
    'CA': [56.1304, -106.3468], // Canada
    'MX': [23.6345, -102.5528], // Mexico
    'EG': [26.8206, 30.8025], // Egypt
    'KE': [-0.0236, 37.9062], // Kenya
    'NG': [9.0820, 8.6753], // Nigeria
    'AR': [-38.4161, -63.6167], // Argentina
    'CO': [4.5709, -74.2973], // Colombia
    'PE': [-9.1900, -75.0152], // Peru
    'SE': [60.1282, 18.6435], // Sweden
    'NO': [60.4720, 8.4689], // Norway
    'FI': [61.9241, 25.7482], // Finland
    'DK': [56.2639, 9.5018], // Denmark
    'NL': [52.1326, 5.2913], // Netherlands
    'ES': [40.4637, -3.7492], // Spain
    'IT': [41.8719, 12.5674], // Italy
    'PL': [51.9194, 19.1451], // Poland
    'UA': [48.3794, 31.1656], // Ukraine
    'TR': [38.9637, 35.2433], // Turkey
    'SA': [23.8859, 45.0792], // Saudi Arabia
    'AE': [23.4241, 53.8478], // UAE
    'IL': [31.0461, 34.8516], // Israel
    'TH': [15.8700, 100.9925], // Thailand
    'VN': [14.0583, 108.2772], // Vietnam
    'ID': [-0.7893, 113.9213], // Indonesia
    'PH': [12.8797, 121.7740], // Philippines
    'KR': [35.9078, 127.7669], // South Korea
    'TW': [23.6978, 120.9605], // Taiwan
    'SG': [1.3521, 103.8198], // Singapore
    'MY': [4.2105, 101.9758], // Malaysia
    'NZ': [-40.9006, 174.8860], // New Zealand
    'PK': [30.3753, 69.3451], // Pakistan
    'BD': [23.6850, 90.3563], // Bangladesh
    'IR': [32.4279, 53.6880], // Iran
    'IQ': [33.2232, 43.6793], // Iraq
    'AF': [33.9391, 67.7100], // Afghanistan
    'GR': [39.0742, 21.8243], // Greece
    'PT': [39.3999, -8.2245], // Portugal
    'CZ': [49.8175, 15.4730], // Czech Republic
    'HU': [47.1625, 19.5033], // Hungary
    'RO': [45.9432, 24.9668], // Romania
    'BG': [42.7339, 25.4858], // Bulgaria
    'HR': [45.1000, 15.2000], // Croatia
    'RS': [44.0165, 21.0059], // Serbia
    'AT': [47.5162, 14.5501], // Austria
    'CH': [46.8182, 8.2275], // Switzerland
    'IE': [53.4129, -8.2439], // Ireland
    'IS': [64.9631, -19.0208], // Iceland
    'MT': [35.9375, 14.3754], // Malta
    'CY': [35.1264, 33.4299], // Cyprus
    'LU': [49.6116, 6.1319], // Luxembourg
    'EE': [58.5953, 25.0136], // Estonia
    'LV': [56.8796, 24.6032], // Latvia
    'LT': [55.1694, 23.8813], // Lithuania
    'SI': [46.1512, 14.9955], // Slovenia
    'SK': [48.6690, 19.6990], // Slovakia
    'AL': [41.1533, 20.1683], // Albania
    'BA': [43.9159, 17.6791], // Bosnia
    'MK': [41.6086, 21.7453], // North Macedonia
    'ME': [42.7087, 19.3744], // Montenegro
    'MD': [47.4116, 28.3699], // Moldova
    'BY': [53.7098, 27.9534], // Belarus
    'GE': [32.1574, -82.9071], // Georgia
    'AM': [40.0691, 45.0382], // Armenia
    'AZ': [40.1431, 47.5769], // Azerbaijan
    'KZ': [48.0196, 66.9237], // Kazakhstan
    'UZ': [41.3775, 64.5853], // Uzbekistan
    'TM': [38.9697, 59.5563], // Turkmenistan
    'KG': [41.2044, 74.7661], // Kyrgyzstan
    'TJ': [38.8610, 71.2761], // Tajikistan
    'MN': [46.8625, 103.8467], // Mongolia
    'KP': [40.3399, 127.5101], // North Korea
    'MM': [21.9162, 95.9560], // Myanmar
    'LA': [19.8563, 102.4955], // Laos
    'KH': [12.5657, 104.9910], // Cambodia
    'BN': [4.5353, 114.7277], // Brunei
    'TL': [-8.8742, 125.7275], // Timor-Leste
    'PG': [-6.314993, 143.95555], // Papua New Guinea
    'FJ': [-17.7134, 178.0650], // Fiji
    'SB': [-9.6457, 160.1562], // Solomon Islands
    'VU': [-15.3767, 166.9592], // Vanuatu
    'NC': [-20.9043, 165.6180], // New Caledonia
    'PF': [-17.6797, -149.4068], // French Polynesia
    'GU': [13.4443, 144.7937], // Guam
    'AS': [-14.2710, -170.1322], // American Samoa
    'KI': [-3.3704, -168.7340], // Kiribati
    'MH': [7.1315, 171.1845], // Marshall Islands
    'FM': [7.4256, 150.5508], // Micronesia
    'NR': [-0.5228, 166.9315], // Nauru
    'PW': [7.5150, 134.5825], // Palau
    'TO': [-21.1790, -175.1982], // Tonga
    'TV': [-7.1095, 177.6493], // Tuvalu
    'WS': [-13.7590, -172.1046], // Samoa
    'CK': [-21.2367, -159.7777], // Cook Islands
    'NU': [-19.0544, -169.8672], // Niue
    'TK': [-8.9674, -171.8559], // Tokelau
    'WF': [-13.7688, -177.1561], // Wallis and Futuna
    'AI': [18.2206, -63.0686], // Anguilla
    'AG': [17.0608, -61.7964], // Antigua and Barbuda
    'BS': [25.0343, -77.3963], // Bahamas
    'BB': [13.1939, -59.5432], // Barbados
    'BZ': [17.1899, -88.4976], // Belize
    'CR': [9.7489, -83.7534], // Costa Rica
    'CU': [21.5218, -77.7812], // Cuba
    'DM': [15.4150, -61.3710], // Dominica
    'DO': [18.7357, -70.1627], // Dominican Republic
    'SV': [13.7942, -88.8965], // El Salvador
    'GD': [12.2628, -61.6042], // Grenada
    'GT': [15.7835, -90.2308], // Guatemala
    'HT': [18.9712, -72.2852], // Haiti
    'HN': [15.2000, -86.2419], // Honduras
    'JM': [18.1096, -77.2975], // Jamaica
    'NI': [12.8654, -85.2072], // Nicaragua
    'PA': [8.5380, -80.7821], // Panama
    'KN': [17.3578, -62.7820], // Saint Kitts and Nevis
    'LC': [13.9094, -60.9789], // Saint Lucia
    'VC': [12.9843, -61.2872], // Saint Vincent
    'TT': [10.6918, -61.2225], // Trinidad and Tobago
    'BO': [-16.2902, -63.5887], // Bolivia
    'EC': [-1.8312, -78.1834], // Ecuador
    'GY': [4.8604, -58.9302], // Guyana
    'PY': [-23.4425, -58.4438], // Paraguay
    'SR': [3.9193, -56.0278], // Suriname
    'UY': [-32.5228, -55.7658], // Uruguay
    'VE': [6.4238, -66.5897], // Venezuela
    'FK': [-51.7963, -59.5236], // Falkland Islands
    'GF': [3.9339, -53.1258], // French Guiana
    'DZ': [28.0339, 1.6596], // Algeria
    'AO': [-11.2027, 17.8739], // Angola
    'BJ': [9.3077, 2.3158], // Benin
    'BW': [-22.3285, 24.6849], // Botswana
    'BF': [12.2383, -1.5616], // Burkina Faso
    'BI': [-3.3731, 29.9189], // Burundi
    'CM': [7.3697, 12.3547], // Cameroon
    'CV': [16.5388, -23.0418], // Cape Verde
    'CF': [6.6111, 20.9394], // Central African Republic
    'TD': [15.4542, 18.7322], // Chad
    'KM': [-11.6455, 43.3333], // Comoros
    'CG': [-0.2280, 15.8277], // Congo
    'CD': [-4.0383, 21.7587], // DR Congo
    'CI': [7.5400, -5.5471], // Côte d'Ivoire
    'DJ': [11.8251, 42.5903], // Djibouti
    'GQ': [1.6508, 10.2679], // Equatorial Guinea
    'ER': [15.1794, 39.7823], // Eritrea
    'SZ': [-26.5225, 31.4659], // Eswatini
    'ET': [9.1450, 40.4897], // Ethiopia
    'GA': [-0.8037, 11.6094], // Gabon
    'GM': [13.4432, -15.3101], // Gambia
    'GH': [7.9465, -1.0232], // Ghana
    'GN': [9.9456, -9.6966], // Guinea
    'GW': [11.8037, -15.1804], // Guinea-Bissau
    'LR': [6.4281, -9.4295], // Liberia
    'LY': [26.3351, 17.2283], // Libya
    'MG': [-18.7669, 46.8691], // Madagascar
    'MW': [-13.2543, 34.3015], // Malawi
    'ML': [17.5707, -3.9962], // Mali
    'MR': [21.0079, -10.9408], // Mauritania
    'MU': [-20.3484, 57.5522], // Mauritius
    'MA': [31.7917, -7.0926], // Morocco
    'MZ': [-18.6657, 35.5296], // Mozambique
    'NA': [-22.9576, 18.4904], // Namibia
    'NE': [17.6078, 8.0817], // Niger
    'RW': [-1.9403, 29.8739], // Rwanda
    'ST': [0.1864, 6.6131], // São Tomé and Príncipe
    'SN': [14.4974, -14.4524], // Senegal
    'SC': [-4.6796, 55.4920], // Seychelles
    'SL': [8.4606, -11.7799], // Sierra Leone
    'SO': [5.1521, 46.1996], // Somalia
    'SS': [6.8770, 31.3070], // South Sudan
    'SD': [12.8628, 30.2176], // Sudan
    'TZ': [-6.3690, 34.8888], // Tanzania
    'TG': [8.6195, 0.8248], // Togo
    'TN': [33.8869, 9.5375], // Tunisia
    'UG': [1.3733, 32.2903], // Uganda
    'ZM': [-13.1339, 27.8493], // Zambia
    'ZW': [-19.0154, 29.1549], // Zimbabwe
    'EH': [24.2155, -12.8858], // Western Sahara
    'SJ': [77.5536, 23.6703], // Svalbard and Jan Mayen
    'BV': [-54.4232, 3.4132], // Bouvet Island
    'HM': [-53.0818, 73.5042], // Heard Island and McDonald Islands
    'IO': [-6.3432, 71.8765], // British Indian Ocean Territory
    'CX': [-10.4475, 105.6904], // Christmas Island
    'CC': [-12.1642, 96.8710], // Cocos (Keeling) Islands
    'NF': [-29.0408, 167.9547], // Norfolk Island
    'PM': [46.9419, -56.2711], // Saint Pierre and Miquelon
    'YT': [-12.8275, 45.1662], // Mayotte
    'RE': [-21.1151, 55.5364], // Réunion
    'GP': [16.2650, -61.5510], // Guadeloupe
    'MQ': [14.6415, -61.0242], // Martinique
    'BL': [17.9000, -62.8333], // Saint Barthélemy
    'MF': [18.0826, -63.0523], // Saint Martin
    'SX': [18.0425, -63.0548], // Sint Maarten
    'AW': [12.5211, -69.9683], // Aruba
    'CW': [12.1696, -68.9900], // Curaçao
    'BQ': [12.1784, -68.2385], // Caribbean Netherlands
    'LI': [47.1660, 9.5554], // Liechtenstein
    'MC': [43.7384, 7.4246], // Monaco
    'SM': [43.9424, 12.4578], // San Marino
    'VA': [41.9029, 12.4534], // Vatican City
    'AD': [42.5462, 1.6016], // Andorra
    'GI': [36.1408, -5.3536], // Gibraltar
    'GG': [49.4657, -2.5853], // Guernsey
    'JE': [49.2144, -2.1313], // Jersey
    'IM': [54.2361, -4.5481], // Isle of Man
    'FO': [61.8926, -6.9118], // Faroe Islands
    'AX': [60.1785, 19.9156], // Åland Islands
    'GL': [71.7069, -42.6043], // Greenland
    'TF': [-49.2804, 69.3486], // French Southern Territories
    'AC': [-7.9467, -14.3559], // Ascension Island
    'TA': [-37.1052, -12.2777], // Tristan da Cunha
    'DG': [-7.3133, 72.4111], // Diego Garcia
    'PN': [-24.7036, -127.4393], // Pitcairn Islands
    'SH': [-24.1435, -10.0307], // Saint Helena
    'GS': [-54.4296, -36.5879], // South Georgia and the South Sandwich Islands
    'TC': [21.6940, -71.7979], // Turks and Caicos Islands
    'VG': [18.4207, -64.6400], // British Virgin Islands
    'KY': [19.3139, -81.2546], // Cayman Islands
    'BM': [32.3078, -64.7505], // Bermuda
    'MS': [16.7425, -62.1874] // Montserrat
  };

  useEffect(() => {
    if (!mapRef.current) {
      // Initialize map
      const map = L.map('world-map', {
        center: [20, 0],
        zoom: 2,
        minZoom: 2,
        maxZoom: 10,
        worldCopyJump: true
      });

      // Add tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(map);

      mapRef.current = map;
      setIsMapReady(true);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!isMapReady || !mapRef.current) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Add markers for all countries with coordinates
    countries.forEach(country => {
      const coords = countryCoordinates[country.code];
      if (!coords) return;

      const isSelected = selectedCountry?.code === country.code;

      const marker = L.marker(coords, {
        icon: L.divIcon({
          className: 'custom-marker',
          html: `<div style="
            width: 12px;
            height: 12px;
            background-color: ${isSelected ? '#3b82f6' : '#6b7280'};
            border: 2px solid ${isSelected ? '#1d4ed8' : '#374151'};
            border-radius: 50%;
            cursor: pointer;
            transition: all 0.2s;
          "></div>`,
          iconSize: [12, 12],
          iconAnchor: [6, 6]
        })
      }).addTo(mapRef.current!);

      // Add popup with country info
      marker.bindPopup(`
        <div style="font-family: system-ui; padding: 4px;">
          <strong>${country.name}</strong><br/>
          <span style="font-size: 12px; color: #666;">
            ${country.language} • ${country.newsSources.length} sources
          </span>
        </div>
      `);

      // Click handler
      marker.on('click', () => {
        onCountrySelect(country);
        marker.openPopup();
      });

      markersRef.current.push(marker);
    });

    // Pan to selected country
    if (selectedCountry) {
      const coords = countryCoordinates[selectedCountry.code];
      if (coords && mapRef.current) {
        mapRef.current.setView(coords, 5, { animate: true, duration: 1 });
      }
    }
  }, [isMapReady, selectedCountry, onCountrySelect]);

  return (
    <div 
      id="world-map" 
      className="w-full h-[400px] rounded-lg border border-slate-700 bg-slate-800"
      style={{ zIndex: 1 }}
    />
  );
}
