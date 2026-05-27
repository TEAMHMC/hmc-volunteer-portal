# Webflow Event Schema — Google Rich Results Setup

## Why This Matters

Google cannot crawl the Event Finder because it is a JavaScript SPA loaded inside an iframe.
To get HMC events to appear as Google event cards in search results, you must inject static
JSON-LD structured data directly into the Webflow page head.

## Option A: Dynamic (Recommended) — Single Script Tag

Paste this into **Webflow Page Settings > Custom Code > Before `</body>` Tag**
for the `/resources/eventfinder` page. It fetches fresh event data from the portal API
so you never need to update the Webflow page manually.

```html
<!-- HMC Event Schema: auto-fetches from portal API, injects Google-readable JSON-LD -->
<script>
(function () {
  fetch('https://hmc-volunteer-portal-172668994130.us-central1.run.app/api/public/events-schema', {
    headers: { 'Accept': 'application/ld+json' }
  })
  .then(function (r) { return r.json(); })
  .then(function (data) {
    var s = document.createElement('script');
    s.type = 'application/ld+json';
    s.id = 'hmc-events-schema';
    s.text = JSON.stringify(data);
    document.head.appendChild(s);
  })
  .catch(function () {});
})();
</script>
```

Note: Google's crawler does execute JavaScript in `<body>` scripts for rich results,
but a static fallback (Option B) is more reliable for indexing speed.

---

## Option B: Static (Copy-Paste, Update Manually)

Paste into **Webflow Page Settings > Custom Code > Head Code** for `/resources/eventfinder`.
Update this list whenever events are added or removed.

```html
<!-- Paste into Webflow Page Settings > Custom Code > Head Code for /resources/eventfinder -->
<script type="application/ld+json" id="hmc-events-schema">
{
  "@context": "https://schema.org",
  "@type": "ItemList",
  "name": "HMC Community Events",
  "description": "Free health and wellness events by Health Matters Clinic across Los Angeles County",
  "url": "https://healthmatters.clinic/resources/eventfinder",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "item": {
        "@type": "Event",
        "name": "TRANSFORM — Unstoppable Experience (Virtual)",
        "startDate": "2026-05-27T19:00:00-07:00",
        "endDate": "2026-05-27T20:00:00-07:00",
        "eventStatus": "https://schema.org/EventScheduled",
        "eventAttendanceMode": "https://schema.org/OnlineEventAttendanceMode",
        "location": {
          "@type": "VirtualLocation",
          "url": "https://healthmatters.clinic/resources/eventfinder?event=event-1773943614235&rsvp=true"
        },
        "organizer": {
          "@type": "Organization",
          "name": "Health Matters Clinic",
          "url": "https://healthmatters.clinic"
        },
        "url": "https://healthmatters.clinic/resources/eventfinder?event=event-1773943614235&rsvp=true",
        "isAccessibleForFree": true,
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD",
          "availability": "https://schema.org/InStock",
          "url": "https://healthmatters.clinic/resources/eventfinder?event=event-1773943614235&rsvp=true"
        },
        "description": "Virtual wellness experience. Join online for connection, healing, and community."
      }
    },
    {
      "@type": "ListItem",
      "position": 2,
      "item": {
        "@type": "Event",
        "name": "Unstoppable Workshop: Physical Well-being",
        "startDate": "2026-06-05T10:15:00-07:00",
        "endDate": "2026-06-05T11:45:00-07:00",
        "eventStatus": "https://schema.org/EventScheduled",
        "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
        "location": {
          "@type": "Place",
          "name": "Palmdale",
          "address": {
            "@type": "PostalAddress",
            "streetAddress": "2072 E. Palmdale Blvd",
            "addressLocality": "Palmdale",
            "addressRegion": "CA",
            "postalCode": "93550",
            "addressCountry": "US"
          }
        },
        "organizer": {
          "@type": "Organization",
          "name": "Health Matters Clinic",
          "url": "https://healthmatters.clinic"
        },
        "url": "https://healthmatters.clinic/resources/eventfinder?event=jun-05-2026&rsvp=true",
        "isAccessibleForFree": true,
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD",
          "availability": "https://schema.org/InStock",
          "url": "https://healthmatters.clinic/resources/eventfinder?event=jun-05-2026&rsvp=true"
        },
        "description": "Explore physical health, movement, and wellness practices."
      }
    },
    {
      "@type": "ListItem",
      "position": 3,
      "item": {
        "@type": "Event",
        "name": "Health + Resources Fair",
        "startDate": "2026-06-06T00:00:00-07:00",
        "eventStatus": "https://schema.org/EventScheduled",
        "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
        "location": {
          "@type": "Place",
          "name": "Lynwood",
          "address": {
            "@type": "PostalAddress",
            "addressLocality": "Lynwood",
            "addressRegion": "CA",
            "addressCountry": "US"
          }
        },
        "organizer": {
          "@type": "Organization",
          "name": "Health Matters Clinic",
          "url": "https://healthmatters.clinic"
        },
        "url": "https://healthmatters.clinic/resources/eventfinder?event=jun-06-2026&rsvp=true",
        "isAccessibleForFree": true,
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD",
          "availability": "https://schema.org/InStock",
          "url": "https://healthmatters.clinic/resources/eventfinder?event=jun-06-2026&rsvp=true"
        },
        "description": "Community health and resources fair."
      }
    },
    {
      "@type": "ListItem",
      "position": 4,
      "item": {
        "@type": "Event",
        "name": "Unstoppable Workshop: Financial Wellness",
        "startDate": "2026-07-10T10:15:00-07:00",
        "endDate": "2026-07-10T11:45:00-07:00",
        "eventStatus": "https://schema.org/EventScheduled",
        "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
        "location": {
          "@type": "Place",
          "name": "Palmdale",
          "address": {
            "@type": "PostalAddress",
            "streetAddress": "2072 E. Palmdale Blvd",
            "addressLocality": "Palmdale",
            "addressRegion": "CA",
            "postalCode": "93550",
            "addressCountry": "US"
          }
        },
        "organizer": {
          "@type": "Organization",
          "name": "Health Matters Clinic",
          "url": "https://healthmatters.clinic"
        },
        "url": "https://healthmatters.clinic/resources/eventfinder?event=jul-10-2026&rsvp=true",
        "isAccessibleForFree": true,
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD",
          "availability": "https://schema.org/InStock",
          "url": "https://healthmatters.clinic/resources/eventfinder?event=jul-10-2026&rsvp=true"
        },
        "description": "Build financial literacy and economic empowerment."
      }
    },
    {
      "@type": "ListItem",
      "position": 5,
      "item": {
        "@type": "Event",
        "name": "Unstoppable Workshop: Environmental Health",
        "startDate": "2026-08-07T10:15:00-07:00",
        "endDate": "2026-08-07T11:45:00-07:00",
        "eventStatus": "https://schema.org/EventScheduled",
        "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
        "location": {
          "@type": "Place",
          "name": "Palmdale",
          "address": {
            "@type": "PostalAddress",
            "streetAddress": "2072 E. Palmdale Blvd",
            "addressLocality": "Palmdale",
            "addressRegion": "CA",
            "postalCode": "93550",
            "addressCountry": "US"
          }
        },
        "organizer": {
          "@type": "Organization",
          "name": "Health Matters Clinic",
          "url": "https://healthmatters.clinic"
        },
        "url": "https://healthmatters.clinic/resources/eventfinder?event=aug-07-2026&rsvp=true",
        "isAccessibleForFree": true,
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD",
          "availability": "https://schema.org/InStock",
          "url": "https://healthmatters.clinic/resources/eventfinder?event=aug-07-2026&rsvp=true"
        },
        "description": "Understand environmental health and community sustainability."
      }
    },
    {
      "@type": "ListItem",
      "position": 6,
      "item": {
        "@type": "Event",
        "name": "Back to School Wellness Event",
        "startDate": "2026-08-08T00:00:00-07:00",
        "eventStatus": "https://schema.org/EventScheduled",
        "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
        "location": {
          "@type": "Place",
          "name": "Huntington Park",
          "address": {
            "@type": "PostalAddress",
            "addressLocality": "Huntington Park",
            "addressRegion": "CA",
            "addressCountry": "US"
          }
        },
        "organizer": {
          "@type": "Organization",
          "name": "Health Matters Clinic",
          "url": "https://healthmatters.clinic"
        },
        "url": "https://healthmatters.clinic/resources/eventfinder?event=aug-08-2026&rsvp=true",
        "isAccessibleForFree": true,
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD",
          "availability": "https://schema.org/InStock",
          "url": "https://healthmatters.clinic/resources/eventfinder?event=aug-08-2026&rsvp=true"
        },
        "description": "Back to school health and wellness fair."
      }
    },
    {
      "@type": "ListItem",
      "position": 7,
      "item": {
        "@type": "Event",
        "name": "Toy Distribution",
        "startDate": "2026-12-12T00:00:00-08:00",
        "eventStatus": "https://schema.org/EventScheduled",
        "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
        "location": {
          "@type": "Place",
          "name": "Huntington Park",
          "address": {
            "@type": "PostalAddress",
            "addressLocality": "Huntington Park",
            "addressRegion": "CA",
            "addressCountry": "US"
          }
        },
        "organizer": {
          "@type": "Organization",
          "name": "Health Matters Clinic",
          "url": "https://healthmatters.clinic"
        },
        "url": "https://healthmatters.clinic/resources/eventfinder?event=dec-12-2026&rsvp=true",
        "isAccessibleForFree": true,
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD",
          "availability": "https://schema.org/InStock",
          "url": "https://healthmatters.clinic/resources/eventfinder?event=dec-12-2026&rsvp=true"
        },
        "description": "Holiday toy distribution event."
      }
    }
  ]
}
</script>
```

---

## Article / Blog Schema — Webflow Blog Pages

Paste into **Webflow Page Settings > Custom Code > Head Code** for each blog/article page.
Replace the placeholder values with real data for each post.

Google requires all of these fields to award rich results (Google News eligibility, article cards):
- `@type`: use `"NewsArticle"` for health/community news, `"Article"` for evergreen content
- `datePublished` and `dateModified`: required, ISO 8601 format
- `author`: with `@type: Person` or `Organization`
- `publisher.logo`: required for Google News
- `headline`: 110 characters max
- `image`: at least one image URL

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "NewsArticle",
  "headline": "REPLACE WITH ARTICLE TITLE (max 110 characters)",
  "description": "REPLACE WITH META DESCRIPTION",
  "datePublished": "2026-05-27T00:00:00-07:00",
  "dateModified": "2026-05-27T00:00:00-07:00",
  "author": {
    "@type": "Organization",
    "name": "Health Matters Clinic",
    "url": "https://healthmatters.clinic"
  },
  "publisher": {
    "@type": "Organization",
    "name": "Health Matters Clinic",
    "url": "https://healthmatters.clinic",
    "logo": {
      "@type": "ImageObject",
      "url": "https://healthmatters.clinic/images/hmc-logo.png",
      "width": 600,
      "height": 60
    }
  },
  "image": [
    "REPLACE WITH ARTICLE FEATURED IMAGE URL"
  ],
  "mainEntityOfPage": {
    "@type": "WebPage",
    "@id": "REPLACE WITH FULL ARTICLE URL"
  }
}
</script>
```

### Current Article Schema Status

The Webflow-Custom-Code directory is empty (no custom code files checked in yet).
Article schema must be added manually to each Webflow blog page using the template above.

### Required fields checklist for Google News eligibility:

| Field | Required | Notes |
|---|---|---|
| `@type: NewsArticle` | Yes | Use this for community health news |
| `headline` | Yes | Max 110 characters, must match H1 |
| `datePublished` | Yes | Must be exact publish date |
| `dateModified` | Yes | Update when content changes |
| `author` | Yes | Name of author or organization |
| `publisher.name` | Yes | Organization name |
| `publisher.logo` | Yes | Rectangular logo, max 600x60px |
| `image` | Yes | At least one image, min 1200px wide recommended |
| `mainEntityOfPage` | Recommended | Full canonical URL |

---

## After Pasting Into Webflow

1. Publish the Webflow page
2. Test using Google's Rich Results Test: https://search.google.com/test/rich-results
   - Enter the URL: `https://healthmatters.clinic/resources/eventfinder`
   - Look for "Event" rich results detected
3. In Google Search Console, go to Enhancements > Events and request validation
4. Google typically surfaces event cards within 2-4 weeks of validation
