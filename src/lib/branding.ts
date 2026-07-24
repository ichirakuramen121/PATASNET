/**
 * Utility to replace all hardcoded occurrences of the default company name 'Taranet'
 * (and its uppercase/lowercase/combination variants) with the dynamically configured company name.
 */
export function replaceCompanyText(text: string, currentCompanyName: string = 'Patas.Net'): string {
  if (!text) return '';
  const cName = currentCompanyName || 'Patas.Net';

  let result = text;
  
  // Replace combined name variations first
  result = result.replace(/Taranet\s+WiFi/gi, cName);
  result = result.replace(/Taranet\s+Wifi/gi, cName);
  result = result.replace(/TARANET\s+WIFI/g, cName.toUpperCase());
  
  // Replace standalone name variations
  result = result.replace(/Taranet/g, cName);
  result = result.replace(/TARANET/g, cName.toUpperCase());
  
  // Special handling for domain names and lowercase references
  result = result.replace(/taranet\.id/gi, `patas.net`);
  result = result.replace(/cs@taranet\.id/gi, `cs@patas.net`);
  result = result.replace(/admin@taranet\.id/gi, `admin@patas.net`);
  result = result.replace(/budi@taranet\.id/gi, `budi@patas.net`);
  
  return result;
}
