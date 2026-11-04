-- Replace YOUR_PROJECT.YOUR_DATASET with the linked GA4 export dataset.
-- Includes a day on either side to avoid truncating sessions at midnight.
WITH events AS (
  SELECT user_pseudo_id,
    (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ga_session_id') AS session_id,
    event_timestamp, event_date, event_name,
    device.web_info.browser AS browser,
    device.web_info.browser_version AS browser_version,
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_location') AS page_location,
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_referrer') AS page_referrer
  FROM `YOUR_PROJECT.YOUR_DATASET.events_*`
  WHERE _TABLE_SUFFIX BETWEEN '20261004' AND '20261019'
), sessions AS (
  SELECT user_pseudo_id, session_id,
    MIN(event_date) AS first_date,
    COUNTIF(event_name = 'page_view') AS page_views,
    STRING_AGG(DISTINCT event_name, ', ' ORDER BY event_name) AS event_names,
    ARRAY_AGG(STRUCT(browser, browser_version, page_location, page_referrer)
      ORDER BY event_timestamp LIMIT 1)[OFFSET(0)] AS first_event
  FROM events
  WHERE user_pseudo_id IS NOT NULL AND session_id IS NOT NULL
  GROUP BY user_pseudo_id, session_id
)
SELECT first_date, event_names, first_event.browser, first_event.browser_version,
  REGEXP_EXTRACT(first_event.page_location, r'^https?://[^/]+([^?#]*)') AS first_path,
  REGEXP_EXTRACT(first_event.page_referrer, r'^https?://([^/]+)') AS referrer_host,
  COUNT(*) AS sessions
FROM sessions
WHERE page_views = 0 AND first_date BETWEEN '20261005' AND '20261018'
GROUP BY ALL
ORDER BY sessions DESC;
