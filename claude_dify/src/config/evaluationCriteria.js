// 67項目の評価基準定義
const evaluationCriteria = {
  accessibility: [
    {
      id: 'a11y-001',
      name: 'Color Contrast Ratio',
      description: 'Text has sufficient color contrast ratio (minimum 4.5:1)',
      impact: 'critical',
      check: async (page) => {
        try {
          await page.addScriptTag({
            content: `
              function getContrastRatio(color1, color2) {
                function getLuminance(r, g, b) {
                  const [rs, gs, bs] = [r, g, b].map(c => {
                    c = c / 255;
                    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
                  });
                  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
                }
                
                const rgb1 = color1.match(/\\d+/g).map(Number);
                const rgb2 = color2.match(/\\d+/g).map(Number);
                const lum1 = getLuminance(...rgb1);
                const lum2 = getLuminance(...rgb2);
                return (Math.max(lum1, lum2) + 0.05) / (Math.min(lum1, lum2) + 0.05);
              }
              
              window.checkContrast = function() {
                const elements = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span, a, button');
                let lowContrastCount = 0;
                let totalElements = 0;
                
                elements.forEach(el => {
                  if (el.offsetParent !== null) {
                    const styles = window.getComputedStyle(el);
                    const textColor = styles.color;
                    const bgColor = styles.backgroundColor;
                    
                    if (textColor && bgColor && bgColor !== 'rgba(0, 0, 0, 0)') {
                      totalElements++;
                      const ratio = getContrastRatio(textColor, bgColor);
                      if (ratio < 4.5) lowContrastCount++;
                    }
                  }
                });
                
                return { lowContrastCount, totalElements, ratio: totalElements > 0 ? (totalElements - lowContrastCount) / totalElements : 1 };
              };
            `
          });
          
          const result = await page.evaluate(() => window.checkContrast());
          return {
            status: result.ratio >= 0.8 ? 'pass' : 'fail',
            details: `${Math.round(result.ratio * 100)}% of text elements have sufficient contrast (${result.totalElements - result.lowContrastCount}/${result.totalElements})`,
            recommendations: result.ratio < 0.8 ? ['Improve color contrast for better readability', 'Use tools like WebAIM Contrast Checker'] : []
          };
        } catch (error) {
          return { status: 'warning', details: `Could not check contrast: ${error.message}` };
        }
      }
    },
    {
      id: 'a11y-002',
      name: 'Alt Text for Images',
      description: 'All images have descriptive alt text',
      impact: 'major',
      check: async (page) => {
        const images = await page.$$eval('img', imgs => 
          imgs.map(img => ({
            src: img.src,
            alt: img.alt,
            hasAlt: !!img.alt && img.alt.trim() !== ''
          }))
        );
        
        const withAlt = images.filter(img => img.hasAlt).length;
        const total = images.length;
        
        return {
          status: total === 0 ? 'info' : (withAlt === total ? 'pass' : 'fail'),
          details: `${withAlt}/${total} images have alt text`,
          recommendations: withAlt < total ? ['Add descriptive alt text to all images', 'Use empty alt="" for decorative images'] : []
        };
      }
    },
    {
      id: 'a11y-003',
      name: 'Heading Structure',
      description: 'Proper heading hierarchy (h1-h6)',
      impact: 'major',
      check: async (page) => {
        const headings = await page.$$eval('h1, h2, h3, h4, h5, h6', headers => 
          headers.map(h => ({ level: parseInt(h.tagName.charAt(1)), text: h.textContent.trim() }))
        );
        
        let hasH1 = headings.some(h => h.level === 1);
        let properHierarchy = true;
        let issues = [];
        
        for (let i = 1; i < headings.length; i++) {
          if (headings[i].level > headings[i-1].level + 1) {
            properHierarchy = false;
            issues.push(`Heading level jumps from h${headings[i-1].level} to h${headings[i].level}`);
          }
        }
        
        return {
          status: hasH1 && properHierarchy ? 'pass' : 'fail',
          details: `Found ${headings.length} headings. H1 present: ${hasH1}. Hierarchy: ${properHierarchy ? 'Good' : 'Issues found'}`,
          recommendations: [
            ...(!hasH1 ? ['Add exactly one h1 element to the page'] : []),
            ...(!properHierarchy ? ['Fix heading hierarchy - avoid skipping levels'] : []),
            ...issues
          ]
        };
      }
    },
    {
      id: 'a11y-004',
      name: 'ARIA Labels',
      description: 'Interactive elements have appropriate ARIA labels',
      impact: 'major',
      check: async (page) => {
        const interactiveElements = await page.$$eval(
          'button, a, input, select, textarea, [role="button"], [role="link"], [tabindex="0"]',
          elements => elements.map(el => ({
            tag: el.tagName.toLowerCase(),
            hasAriaLabel: !!el.getAttribute('aria-label'),
            hasAriaLabelledby: !!el.getAttribute('aria-labelledby'),
            hasAriaDescribedby: !!el.getAttribute('aria-describedby'),
            text: el.textContent?.trim() || '',
            type: el.type || '',
            role: el.getAttribute('role') || ''
          }))
        );
        
        const needsLabeling = interactiveElements.filter(el => 
          !el.hasAriaLabel && !el.hasAriaLabelledby && !el.text && 
          !['submit', 'button'].includes(el.type)
        );
        
        return {
          status: needsLabeling.length === 0 ? 'pass' : 'warning',
          details: `${interactiveElements.length - needsLabeling.length}/${interactiveElements.length} interactive elements have proper labeling`,
          recommendations: needsLabeling.length > 0 ? [
            'Add aria-label or aria-labelledby to unlabeled interactive elements',
            'Ensure buttons and links have descriptive text'
          ] : []
        };
      }
    },
    {
      id: 'a11y-005',
      name: 'Keyboard Navigation',
      description: 'All interactive elements are keyboard accessible',
      impact: 'critical',
      check: async (page) => {
        const focusableElements = await page.$$eval(
          'a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
          elements => elements.length
        );
        
        const withTabindex = await page.$$eval('[tabindex]', elements => 
          elements.map(el => parseInt(el.getAttribute('tabindex')))
        );
        
        const positiveTabindex = withTabindex.filter(t => t > 0).length;
        
        return {
          status: focusableElements > 0 && positiveTabindex === 0 ? 'pass' : 'warning',
          details: `${focusableElements} focusable elements found. Positive tabindex usage: ${positiveTabindex}`,
          recommendations: [
            ...(positiveTabindex > 0 ? ['Avoid positive tabindex values - use natural tab order'] : []),
            'Test keyboard navigation with Tab key'
          ]
        };
      }
    }
  ],

  performance: [
    {
      id: 'perf-001',
      name: 'Page Load Time',
      description: 'Page loads within 3 seconds',
      impact: 'critical',
      check: async (page, startTime) => {
        const loadTime = Date.now() - startTime;
        return {
          status: loadTime < 3000 ? 'pass' : (loadTime < 5000 ? 'warning' : 'fail'),
          details: `Page loaded in ${loadTime}ms`,
          recommendations: loadTime >= 3000 ? [
            'Optimize images and compress assets',
            'Minimize HTTP requests',
            'Use CDN for static assets',
            'Enable browser caching'
          ] : []
        };
      }
    },
    {
      id: 'perf-002',
      name: 'Image Optimization',
      description: 'Images are properly optimized',
      impact: 'major',
      check: async (page) => {
        const images = await page.$$eval('img', imgs => 
          imgs.map(img => ({
            src: img.src,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
            displayWidth: img.offsetWidth,
            displayHeight: img.offsetHeight,
            hasWebP: img.src.includes('.webp'),
            hasModernFormat: img.src.match(/\\.(webp|avif)$/i)
          }))
        );
        
        const oversized = images.filter(img => 
          img.naturalWidth > img.displayWidth * 2 || 
          img.naturalHeight > img.displayHeight * 2
        ).length;
        
        const modernFormat = images.filter(img => img.hasModernFormat).length;
        
        return {
          status: oversized === 0 ? 'pass' : 'warning',
          details: `${images.length} images found. ${oversized} oversized, ${modernFormat} use modern formats`,
          recommendations: [
            ...(oversized > 0 ? ['Resize images to appropriate dimensions'] : []),
            ...(modernFormat < images.length * 0.5 ? ['Use modern image formats (WebP, AVIF)'] : [])
          ]
        };
      }
    },
    {
      id: 'perf-003',
      name: 'CSS Optimization',
      description: 'CSS is optimized and minified',
      impact: 'minor',
      check: async (page) => {
        const stylesheets = await page.$$eval('link[rel="stylesheet"]', links => 
          links.map(link => link.href)
        );
        
        const inlineStyles = await page.$$eval('style', styles => 
          styles.map(style => style.textContent.length)
        );
        
        const totalInlineSize = inlineStyles.reduce((sum, size) => sum + size, 0);
        
        return {
          status: stylesheets.length < 5 && totalInlineSize < 10000 ? 'pass' : 'warning',
          details: `${stylesheets.length} external stylesheets, ${totalInlineSize} bytes of inline CSS`,
          recommendations: [
            ...(stylesheets.length >= 5 ? ['Combine CSS files to reduce HTTP requests'] : []),
            ...(totalInlineSize >= 10000 ? ['Move large inline styles to external files'] : [])
          ]
        };
      }
    }
  ],

  seo: [
    {
      id: 'seo-001',
      name: 'Title Tag',
      description: 'Page has unique and descriptive title',
      impact: 'critical',
      check: async (page) => {
        const title = await page.title();
        return {
          status: title && title.length >= 30 && title.length <= 60 ? 'pass' : 'fail',
          details: `Title: "${title}" (${title?.length || 0} characters)`,
          recommendations: [
            ...((!title || title.length < 30) ? ['Add descriptive title (30+ characters)'] : []),
            ...(title && title.length > 60 ? ['Shorten title to under 60 characters'] : [])
          ]
        };
      }
    },
    {
      id: 'seo-002',
      name: 'Meta Description',
      description: 'Page has compelling meta description',
      impact: 'major',
      check: async (page) => {
        const metaDesc = await page.$eval('meta[name="description"]', el => el.content).catch(() => null);
        return {
          status: metaDesc && metaDesc.length >= 120 && metaDesc.length <= 160 ? 'pass' : 'fail',
          details: `Meta description: ${metaDesc ? `"${metaDesc}" (${metaDesc.length} characters)` : 'Not found'}`,
          recommendations: [
            ...(!metaDesc ? ['Add meta description'] : []),
            ...(metaDesc && (metaDesc.length < 120 || metaDesc.length > 160) ? ['Optimize meta description length (120-160 characters)'] : [])
          ]
        };
      }
    }
  ],

  security: [
    {
      id: 'sec-001',
      name: 'HTTPS Usage',
      description: 'Site uses HTTPS protocol',
      impact: 'critical',
      check: async (page) => {
        const url = page.url();
        return {
          status: url.startsWith('https://') ? 'pass' : 'fail',
          details: `Protocol: ${url.split('://')[0]}`,
          recommendations: url.startsWith('https://') ? [] : ['Implement HTTPS with valid SSL certificate']
        };
      }
    },
    {
      id: 'sec-002',
      name: 'Security Headers',
      description: 'Essential security headers are present',
      impact: 'major',
      check: async (page) => {
        const response = await page.goto(page.url());
        const headers = response.headers();
        
        const securityHeaders = {
          'x-frame-options': !!headers['x-frame-options'],
          'x-content-type-options': !!headers['x-content-type-options'],
          'x-xss-protection': !!headers['x-xss-protection'],
          'strict-transport-security': !!headers['strict-transport-security']
        };
        
        const presentHeaders = Object.values(securityHeaders).filter(Boolean).length;
        
        return {
          status: presentHeaders >= 3 ? 'pass' : 'warning',
          details: `${presentHeaders}/4 security headers present`,
          recommendations: [
            ...(!securityHeaders['x-frame-options'] ? ['Add X-Frame-Options header'] : []),
            ...(!securityHeaders['x-content-type-options'] ? ['Add X-Content-Type-Options header'] : []),
            ...(!securityHeaders['strict-transport-security'] ? ['Add Strict-Transport-Security header'] : [])
          ]
        };
      }
    }
  ],

  usability: [
    {
      id: 'use-001',
      name: 'Mobile Responsive',
      description: 'Site is mobile responsive',
      impact: 'critical',
      check: async (page) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await page.waitForTimeout(1000);
        
        const hasViewportMeta = await page.$('meta[name="viewport"]') !== null;
        const horizontalScroll = await page.evaluate(() => document.body.scrollWidth > window.innerWidth);
        
        return {
          status: hasViewportMeta && !horizontalScroll ? 'pass' : 'fail',
          details: `Viewport meta: ${hasViewportMeta}, Horizontal scroll: ${horizontalScroll}`,
          recommendations: [
            ...(!hasViewportMeta ? ['Add viewport meta tag'] : []),
            ...(horizontalScroll ? ['Fix horizontal scrolling on mobile'] : [])
          ]
        };
      }
    },
    {
      id: 'use-002',
      name: 'Navigation Structure',
      description: 'Clear and consistent navigation',
      impact: 'major',
      check: async (page) => {
        const navElements = await page.$$eval('nav, [role="navigation"]', navs => navs.length);
        const menuItems = await page.$$eval('nav a, nav button', items => items.length);
        
        return {
          status: navElements > 0 && menuItems > 0 ? 'pass' : 'warning',
          details: `${navElements} navigation elements with ${menuItems} menu items`,
          recommendations: navElements === 0 ? ['Add semantic navigation structure'] : []
        };
      }
    }
  ]
};

module.exports = evaluationCriteria;