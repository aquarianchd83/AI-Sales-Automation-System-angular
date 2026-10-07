/**
 * The cities a tenant can pick as lead-discovery locations, by country and grouped by state (or the country's
 * nearest equivalent: province, region, emirate...). Keyed by the same ISO codes as the tenant's country in its profile,
 * covering every country the platform sells in. Major cities and the towns around them - a search for "eye clinic in
 * Mohali" needs Mohali listed, not just Chandigarh - not every settlement; anything else a tenant already saved still
 * shows (see cityGroupsFor).
 *
 * Written as "Region: City, City" lines so each country stays easy to read and to extend.
 */
const RAW: Record<string, { country: string; lines: string[] }> = {
  IN: {
    country: 'India',
    lines: [
      'Andhra Pradesh: Visakhapatnam, Vijayawada, Guntur, Tirupati, Nellore, Kurnool, Rajahmundry, Kakinada, Anantapur',
      'Arunachal Pradesh: Itanagar, Naharlagun',
      'Assam: Guwahati, Silchar, Dibrugarh, Jorhat, Nagaon, Tezpur',
      'Bihar: Patna, Gaya, Bhagalpur, Muzaffarpur, Purnia, Darbhanga, Arrah',
      'Chandigarh: Chandigarh',
      'Chhattisgarh: Raipur, Bhilai, Bilaspur, Korba, Durg, Raigarh',
      'Delhi: New Delhi, Delhi, Dwarka, Rohini, Saket, Karol Bagh',
      'Goa: Panaji, Margao, Vasco da Gama, Mapusa',
      'Gujarat: Ahmedabad, Surat, Vadodara, Rajkot, Bhavnagar, Jamnagar, Gandhinagar, Junagadh, Anand, Bharuch',
      'Haryana: Gurugram, Faridabad, Panipat, Ambala, Karnal, Hisar, Rohtak, Sonipat, Panchkula, Yamunanagar',
      'Himachal Pradesh: Shimla, Dharamshala, Solan, Mandi, Kullu, Baddi',
      'Jammu and Kashmir: Srinagar, Jammu, Anantnag, Baramulla',
      'Jharkhand: Ranchi, Jamshedpur, Dhanbad, Bokaro, Hazaribagh, Deoghar',
      'Karnataka: Bengaluru, Mysuru, Mangaluru, Hubballi, Belagavi, Kalaburagi, Davanagere, Ballari, Shivamogga, Udupi',
      'Kerala: Thiruvananthapuram, Kochi, Kozhikode, Thrissur, Kollam, Kannur, Alappuzha, Palakkad, Kottayam',
      'Ladakh: Leh, Kargil',
      'Madhya Pradesh: Indore, Bhopal, Jabalpur, Gwalior, Ujjain, Sagar, Dewas, Satna, Ratlam, Rewa',
      'Maharashtra: Mumbai, Pune, Nagpur, Thane, Nashik, Aurangabad, Navi Mumbai, Solapur, Kolhapur, Amravati, Nanded, Sangli, Andheri West',
      'Manipur: Imphal',
      'Meghalaya: Shillong, Tura',
      'Mizoram: Aizawl',
      'Nagaland: Kohima, Dimapur',
      'Odisha: Bhubaneswar, Cuttack, Rourkela, Berhampur, Sambalpur, Puri',
      'Puducherry: Puducherry, Karaikal',
      'Punjab: Ludhiana, Amritsar, Jalandhar, Patiala, Bathinda, Mohali, Pathankot, Hoshiarpur, Moga, Firozpur, Kharar, Zirakpur',
      'Rajasthan: Jaipur, Jodhpur, Udaipur, Kota, Ajmer, Bikaner, Alwar, Bhilwara, Sikar, Sri Ganganagar',
      'Sikkim: Gangtok',
      'Tamil Nadu: Chennai, Coimbatore, Madurai, Tiruchirappalli, Salem, Tirunelveli, Erode, Vellore, Thoothukudi, Tiruppur, Thanjavur',
      'Telangana: Hyderabad, Warangal, Nizamabad, Karimnagar, Khammam, Secunderabad',
      'Tripura: Agartala',
      'Uttar Pradesh: Lucknow, Kanpur, Noida, Ghaziabad, Agra, Varanasi, Meerut, Prayagraj, Bareilly, Aligarh, Moradabad, Gorakhpur, Greater Noida, Mathura',
      'Uttarakhand: Dehradun, Haridwar, Haldwani, Roorkee, Rishikesh, Rudrapur',
      'West Bengal: Kolkata, Howrah, Durgapur, Asansol, Siliguri, Bardhaman, Kharagpur',
    ],
  },
  US: {
    country: 'United States',
    lines: [
      'Alabama: Birmingham, Montgomery, Huntsville, Mobile',
      'Alaska: Anchorage, Fairbanks, Juneau',
      'Arizona: Phoenix, Tucson, Mesa, Scottsdale, Chandler',
      'Arkansas: Little Rock, Fayetteville, Fort Smith',
      'California: Los Angeles, San Diego, San Jose, San Francisco, Sacramento, Fresno, Oakland, Irvine, Long Beach',
      'Colorado: Denver, Colorado Springs, Aurora, Boulder, Fort Collins',
      'Connecticut: Hartford, New Haven, Stamford, Bridgeport',
      'Delaware: Wilmington, Dover',
      'Florida: Miami, Orlando, Tampa, Jacksonville, Fort Lauderdale, Tallahassee, St. Petersburg',
      'Georgia: Atlanta, Savannah, Augusta, Columbus',
      'Hawaii: Honolulu, Hilo',
      'Idaho: Boise, Meridian, Idaho Falls',
      'Illinois: Chicago, Aurora, Naperville, Springfield, Rockford',
      'Indiana: Indianapolis, Fort Wayne, Evansville, South Bend',
      'Iowa: Des Moines, Cedar Rapids, Davenport',
      'Kansas: Wichita, Overland Park, Kansas City, Topeka',
      'Kentucky: Louisville, Lexington, Bowling Green',
      'Louisiana: New Orleans, Baton Rouge, Shreveport, Lafayette',
      'Maine: Portland, Augusta, Bangor',
      'Maryland: Baltimore, Rockville, Annapolis, Frederick',
      'Massachusetts: Boston, Worcester, Cambridge, Springfield',
      'Michigan: Detroit, Grand Rapids, Ann Arbor, Lansing',
      'Minnesota: Minneapolis, Saint Paul, Rochester, Duluth',
      'Mississippi: Jackson, Gulfport, Biloxi',
      'Missouri: Kansas City, St. Louis, Springfield, Columbia',
      'Montana: Billings, Missoula, Bozeman',
      'Nebraska: Omaha, Lincoln',
      'Nevada: Las Vegas, Reno, Henderson, Carson City',
      'New Hampshire: Manchester, Nashua, Concord',
      'New Jersey: Newark, Jersey City, Paterson, Edison',
      'New Mexico: Albuquerque, Santa Fe, Las Cruces',
      'New York: New York City, Buffalo, Rochester, Albany, Syracuse, Yonkers',
      'North Carolina: Charlotte, Raleigh, Greensboro, Durham, Asheville',
      'North Dakota: Fargo, Bismarck',
      'Ohio: Columbus, Cleveland, Cincinnati, Toledo, Akron',
      'Oklahoma: Oklahoma City, Tulsa, Norman',
      'Oregon: Portland, Salem, Eugene, Bend',
      'Pennsylvania: Philadelphia, Pittsburgh, Allentown, Harrisburg',
      'Rhode Island: Providence, Warwick, Cranston',
      'South Carolina: Charleston, Columbia, Greenville',
      'South Dakota: Sioux Falls, Rapid City',
      'Tennessee: Nashville, Memphis, Knoxville, Chattanooga',
      'Texas: Houston, Dallas, Austin, San Antonio, Fort Worth, El Paso, Plano',
      'Utah: Salt Lake City, Provo, Ogden, St. George',
      'Vermont: Burlington, Montpelier',
      'Virginia: Virginia Beach, Richmond, Arlington, Norfolk, Alexandria',
      'Washington: Seattle, Spokane, Tacoma, Bellevue, Vancouver',
      'District of Columbia: Washington',
      'West Virginia: Charleston, Huntington, Morgantown',
      'Wisconsin: Milwaukee, Madison, Green Bay',
      'Wyoming: Cheyenne, Casper, Laramie',
    ],
  },
  GB: {
    country: 'United Kingdom',
    lines: [
      'England - London: London, Croydon, Bromley, Ealing',
      'England - South East: Brighton, Southampton, Portsmouth, Reading, Oxford, Milton Keynes, Canterbury',
      'England - South West: Bristol, Plymouth, Exeter, Bath, Bournemouth, Gloucester',
      'England - East of England: Norwich, Cambridge, Ipswich, Luton, Peterborough, Chelmsford',
      'England - West Midlands: Birmingham, Coventry, Wolverhampton, Stoke-on-Trent, Worcester',
      'England - East Midlands: Nottingham, Leicester, Derby, Lincoln, Northampton',
      'England - North West: Manchester, Liverpool, Preston, Blackpool, Chester, Salford',
      'England - North East: Newcastle upon Tyne, Sunderland, Durham, Middlesbrough',
      'England - Yorkshire and the Humber: Leeds, Sheffield, Bradford, York, Hull',
      'Scotland: Glasgow, Edinburgh, Aberdeen, Dundee, Inverness',
      'Wales: Cardiff, Swansea, Newport, Wrexham',
      'Northern Ireland: Belfast, Derry, Lisburn',
    ],
  },
  DE: {
    country: 'Germany',
    lines: [
      'Baden-Württemberg: Stuttgart, Mannheim, Karlsruhe, Freiburg, Heidelberg, Ulm',
      'Bavaria: Munich, Nuremberg, Augsburg, Regensburg, Würzburg',
      'Berlin: Berlin',
      'Brandenburg: Potsdam, Cottbus',
      'Bremen: Bremen, Bremerhaven',
      'Hamburg: Hamburg',
      'Hesse: Frankfurt, Wiesbaden, Kassel, Darmstadt',
      'Lower Saxony: Hanover, Braunschweig, Osnabrück, Oldenburg, Göttingen',
      'Mecklenburg-Vorpommern: Rostock, Schwerin',
      'North Rhine-Westphalia: Cologne, Düsseldorf, Dortmund, Essen, Duisburg, Bochum, Bonn, Münster',
      'Rhineland-Palatinate: Mainz, Ludwigshafen, Koblenz, Trier',
      'Saarland: Saarbrücken',
      'Saxony: Dresden, Leipzig, Chemnitz',
      'Saxony-Anhalt: Magdeburg, Halle',
      'Schleswig-Holstein: Kiel, Lübeck, Flensburg',
      'Thuringia: Erfurt, Jena',
    ],
  },
  FR: {
    country: 'France',
    lines: [
      'Auvergne-Rhône-Alpes: Lyon, Grenoble, Saint-Étienne, Clermont-Ferrand, Annecy',
      'Bourgogne-Franche-Comté: Dijon, Besançon',
      'Brittany: Rennes, Brest, Quimper, Lorient',
      'Centre-Val de Loire: Tours, Orléans',
      'Corsica: Ajaccio, Bastia',
      'Grand Est: Strasbourg, Reims, Metz, Nancy, Mulhouse',
      'Hauts-de-France: Lille, Amiens, Roubaix',
      'Île-de-France: Paris, Versailles, Boulogne-Billancourt, Saint-Denis',
      'Normandy: Rouen, Caen, Le Havre',
      'Nouvelle-Aquitaine: Bordeaux, Limoges, Poitiers, La Rochelle',
      'Occitanie: Toulouse, Montpellier, Nîmes, Perpignan',
      'Pays de la Loire: Nantes, Angers, Le Mans',
      "Provence-Alpes-Côte d'Azur: Marseille, Nice, Toulon, Aix-en-Provence, Avignon",
    ],
  },
  ES: {
    country: 'Spain',
    lines: [
      'Andalusia: Seville, Málaga, Córdoba, Granada, Almería, Cádiz',
      'Aragon: Zaragoza, Huesca',
      'Asturias: Oviedo, Gijón',
      'Balearic Islands: Palma',
      'Basque Country: Bilbao, Vitoria-Gasteiz, San Sebastián',
      'Canary Islands: Las Palmas, Santa Cruz de Tenerife',
      'Cantabria: Santander',
      'Castile and León: Valladolid, Burgos, Salamanca, León',
      'Castilla-La Mancha: Toledo, Albacete',
      'Catalonia: Barcelona, Girona, Tarragona, Lleida',
      'Extremadura: Badajoz, Cáceres',
      'Galicia: Vigo, A Coruña, Santiago de Compostela',
      'La Rioja: Logroño',
      'Madrid: Madrid, Alcalá de Henares, Getafe',
      'Murcia: Murcia, Cartagena',
      'Navarre: Pamplona',
      'Valencia: Valencia, Alicante, Elche, Castellón',
    ],
  },
  IT: {
    country: 'Italy',
    lines: [
      'Abruzzo: Pescara, L’Aquila',
      'Basilicata: Potenza, Matera',
      'Calabria: Reggio Calabria, Catanzaro, Cosenza',
      'Campania: Naples, Salerno, Caserta',
      'Emilia-Romagna: Bologna, Parma, Modena, Rimini, Ravenna',
      'Friuli-Venezia Giulia: Trieste, Udine',
      'Lazio: Rome, Latina',
      'Liguria: Genoa, La Spezia',
      'Lombardy: Milan, Bergamo, Brescia, Monza, Como',
      'Marche: Ancona, Pesaro',
      'Molise: Campobasso',
      'Piedmont: Turin, Novara, Alessandria',
      'Puglia: Bari, Taranto, Lecce',
      'Sardinia: Cagliari, Sassari',
      'Sicily: Palermo, Catania, Messina, Syracuse',
      'Trentino-South Tyrol: Trento, Bolzano',
      'Tuscany: Florence, Pisa, Livorno, Siena',
      'Umbria: Perugia, Terni',
      "Aosta Valley: Aosta",
      'Veneto: Venice, Verona, Padua, Treviso',
    ],
  },
  NL: {
    country: 'Netherlands',
    lines: [
      'Drenthe: Assen, Emmen',
      'Flevoland: Almere, Lelystad',
      'Friesland: Leeuwarden',
      'Gelderland: Arnhem, Nijmegen, Apeldoorn',
      'Groningen: Groningen',
      'Limburg: Maastricht, Venlo, Heerlen',
      'North Brabant: Eindhoven, Tilburg, Breda, Den Bosch',
      'North Holland: Amsterdam, Haarlem, Alkmaar, Hilversum',
      'Overijssel: Enschede, Zwolle, Deventer',
      'South Holland: Rotterdam, The Hague, Leiden, Dordrecht, Delft',
      'Utrecht: Utrecht, Amersfoort',
      'Zeeland: Middelburg, Vlissingen',
    ],
  },
  CA: {
    country: 'Canada',
    lines: [
      'Alberta: Calgary, Edmonton, Red Deer, Lethbridge',
      'British Columbia: Vancouver, Victoria, Surrey, Burnaby, Kelowna',
      'Manitoba: Winnipeg, Brandon',
      'New Brunswick: Moncton, Saint John, Fredericton',
      'Newfoundland and Labrador: St. John’s',
      'Northwest Territories: Yellowknife',
      'Nova Scotia: Halifax, Sydney',
      'Nunavut: Iqaluit',
      'Ontario: Toronto, Ottawa, Mississauga, Brampton, Hamilton, London, Markham, Vaughan',
      'Prince Edward Island: Charlottetown',
      'Quebec: Montreal, Quebec City, Laval, Gatineau, Sherbrooke',
      'Saskatchewan: Saskatoon, Regina',
      'Yukon: Whitehorse',
    ],
  },
  AU: {
    country: 'Australia',
    lines: [
      'Australian Capital Territory: Canberra',
      'New South Wales: Sydney, Newcastle, Wollongong, Central Coast, Parramatta',
      'Northern Territory: Darwin, Alice Springs',
      'Queensland: Brisbane, Gold Coast, Sunshine Coast, Townsville, Cairns',
      'South Australia: Adelaide, Mount Gambier',
      'Tasmania: Hobart, Launceston',
      'Victoria: Melbourne, Geelong, Ballarat, Bendigo',
      'Western Australia: Perth, Fremantle, Bunbury, Mandurah',
    ],
  },
  AE: {
    country: 'United Arab Emirates',
    lines: [
      'Abu Dhabi: Abu Dhabi, Al Ain, Madinat Zayed',
      'Ajman: Ajman',
      'Dubai: Dubai, Deira, Bur Dubai, Jumeirah, Al Barsha, Dubai Marina',
      'Fujairah: Fujairah',
      'Ras Al Khaimah: Ras Al Khaimah',
      'Sharjah: Sharjah, Khor Fakkan',
      'Umm Al Quwain: Umm Al Quwain',
    ],
  },
  SG: {
    country: 'Singapore',
    lines: [
      'Central Region: Orchard, Downtown Core, Novena, Toa Payoh, Bishan, Queenstown',
      'East Region: Tampines, Bedok, Pasir Ris, Changi',
      'North Region: Woodlands, Yishun, Sembawang',
      'North-East Region: Sengkang, Punggol, Hougang, Serangoon',
      'West Region: Jurong East, Jurong West, Clementi, Bukit Batok, Choa Chu Kang',
    ],
  },
};

/** One city a tenant can pick. `value` is what is saved as the location: the city and its state ("Mohali, Punjab") so two
 * cities of one name stay apart and the web search knows which one - or just the city when it is its own region. */
export interface CityOption {
  city: string;
  value: string;
}

export interface CityGroup {
  /** The state, province, region or emirate. */
  name: string;
  cities: CityOption[];
}

/** The value saved for a city: "City, Region", or just the city where the two are the same (Chandigarh, Singapore). */
export function cityValue(city: string, region: string): string {
  const short = region.replace(/^England - /, '');
  return short.toLowerCase() === city.toLowerCase() ? city : `${city}, ${short}`;
}

/** Whether the catalog has cities for this country. */
export function hasCities(countryCode: string | null | undefined): boolean {
  return !!countryCode && !!RAW[countryCode.toUpperCase()];
}

export function countryName(countryCode: string | null | undefined): string | null {
  return (countryCode && RAW[countryCode.toUpperCase()]?.country) || null;
}

/**
 * The picker's groups for a country: its cities by state, plus an "Already saved" group for anything selected that the
 * catalog does not carry (a location typed before this list existed, or one from another country) - so nothing a tenant
 * has saved silently disappears from the dropdown.
 */
export function cityGroupsFor(countryCode: string | null | undefined, selected: readonly string[] = []): CityGroup[] {
  const country = countryCode ? RAW[countryCode.toUpperCase()] : undefined;
  if (!country) {
    return [];
  }
  const groups: CityGroup[] = country.lines.map((line) => {
    const split = line.indexOf(':');
    const name = line.slice(0, split).trim();
    return {
      name,
      cities: line
        .slice(split + 1)
        .split(',')
        .map((city) => city.trim())
        .filter(Boolean)
        .map((city) => ({ city, value: cityValue(city, name) })),
    };
  });

  const known = new Set(groups.flatMap((g) => g.cities.map((c) => c.value.toLowerCase())));
  const extra = selected.filter((value) => !known.has(value.toLowerCase()));
  return extra.length ? [{ name: 'Already saved', cities: extra.map((value) => ({ city: value, value })) }, ...groups] : groups;
}

/** The groups with only the cities (or states) matching what was typed; a state that matches keeps all its cities. */
export function filterCityGroups(groups: readonly CityGroup[], term: string): CityGroup[] {
  const needle = term.trim().toLowerCase();
  if (!needle) {
    return [...groups];
  }
  return groups
    .map((group) =>
      group.name.toLowerCase().includes(needle)
        ? group
        : { ...group, cities: group.cities.filter((c) => c.city.toLowerCase().includes(needle)) }
    )
    .filter((group) => group.cities.length > 0);
}
