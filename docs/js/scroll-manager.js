/**
 * Optimizes smooth scroll handling.
 * @param {Element} element - The element to scroll to.
 */
const smoothScrollTo = (element) => {
  if (!element) {
    console.warn('Attempted to scroll to a null element.');
    return;
  }

  // Use native smooth scroll with fallback
  if ('scrollBehavior' in document.documentElement.style) {
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  } else {
    // Fallback for browsers that don't support smooth scroll
    window.scrollTo({
      top: element.offsetTop,
      behavior: 'smooth', 
    });
  }
};

/**
 * Handles changes to the URL hash to scroll to the target element.
 * @returns {void}
 */
const hashChangerHandler = () => {
  const hash = window.location.hash;
  if (!hash) {
    return;
  }

  // Escape potential special characters in the hash for robust selection
  const escapedHash = CSS.escape(hash);
  const element = document.querySelector(`[href="${escapedHash}"]`);

  if (!element) {
    console.warn(`Element with href="${escapedHash}" not found.`);
    return;
  }

  smoothScrollTo(element);
};

/**
 * Updates the active section based on the current scroll position using debouncing.
 */
const updateActiveSection = (() => {
  // Cache selectors outside the function to avoid repeated lookups
  const activators = document.querySelectorAll('.c-heading-anchor');
  const headingLinks = document.querySelectorAll('.c-heading-anchor__link');

  let scrollTimeout;
  const debounceDelay = 100;

  const processScroll = () => {
    requestAnimationFrame(() => {
      if (window.scrollY <= 50 && window.location.hash) {
        headingLinks.forEach((link) =>
          link.classList.remove('c-heading-anchor__link--active'),
        );
        history.replaceState(null, null, window.location.pathname);
        return;
      }

      let currentActivator = null;
      let maxVisibility = 0;

      for (let i = 0; i < activators.length; i++) {
        const activator = activators[i];
        const rect = activator.getBoundingClientRect();

        if (rect.top < window.innerHeight && rect.bottom > 0) {
          const visibility =
            Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);

          if (visibility > maxVisibility) {
            maxVisibility = visibility;
            currentActivator = activator.querySelector(
              "a[class='c-heading-anchor__link']",
            );
          }
        }
      }

      if (currentActivator) {
        const currentHref = currentActivator.getAttribute('href');

        const currentHash = window.location.hash;
        if (currentHash !== currentHref) {
          history.replaceState(null, null, currentHref);


          headingLinks.forEach((link) => {
            link.classList.toggle(
              'c-heading-anchor__link--active',
              link.getAttribute('href') === currentHref,
            );
          });
        }
      } else {

        headingLinks.forEach((link) =>
          link.classList.remove('c-heading-anchor__link--active'),
        );
        if (window.location.hash) {
          history.replaceState(null, null, window.location.pathname);
        }
      }
    });
  };


  return () => {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(processScroll, debounceDelay);
  };
})();

/**
 * Main function to handle all event listeners.
 */
const scrollManager = () => {
  window.addEventListener('hashchange', hashChangerHandler);

  // Handle initial hash on page load
  if (window.location.hash) {
    requestAnimationFrame(() => {
      const escapedHash = CSS.escape(window.location.hash);
      const targetElement = document.querySelector(`[href="${escapedHash}"]`);
      if (targetElement) {

        requestAnimationFrame(() => smoothScrollTo(targetElement));
      }
    });
  }

  window.addEventListener('scroll', updateActiveSection, {
    passive: true
  });
};

// Initialize once DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', scrollManager);
} else {
  scrollManager();
}
