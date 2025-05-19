/**
 * Handles the favicon based on the visibility of the page.
 */
const faviconHandler = () => {
  const favicon = document.querySelector('link[rel="icon"][sizes="any"]');
  if (!favicon) {
    console.warn('Favicon link element not found.');
    return;
  }
  // get current favicon path
  const currentFavicon = favicon.getAttribute('href');

  // Set the favicon path based on visibility
  // if the page is hidden, set a different favicon i.e. add a "hidden" suffix
  const faviconPath = document.hidden ?
    currentFavicon.replace(/(\.[a-z]{2,4})$/, '-hidden$1') :
    currentFavicon.replace(/-hidden(\.[a-z]{2,4})$/, '$1');
    
  favicon.setAttribute('href', faviconPath);
};

// Initialize once DOM is loaded
if (document.readyState === 'loading') 
  document.addEventListener('DOMContentLoaded', document.addEventListener('visibilitychange', faviconHandler));
else 
  document.addEventListener('visibilitychange', faviconHandler);
