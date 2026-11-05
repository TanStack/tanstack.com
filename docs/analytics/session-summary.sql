-- Run daily after the GA daily export. Rebuild four start-date partitions to
-- include late arrivals. A one-time backfill can widen start_date/end_date.
DECLARE start_date DATE DEFAULT DATE_SUB(CURRENT_DATE('UTC'), INTERVAL 4 DAY);
DECLARE end_date DATE DEFAULT CURRENT_DATE('UTC');

CREATE TABLE IF NOT EXISTS `tanstack-analytics.reporting.sessions`
(
  session_date DATE,
  user_pseudo_id STRING,
  session_id INT64,
  first_event_at TIMESTAMP,
  last_event_at TIMESTAMP,
  hostname STRING,
  landing_path STRING,
  referrer_host STRING,
  source STRING,
  medium STRING,
  default_channel_group STRING,
  channel_group STRING,
  country STRING,
  browser STRING,
  is_new_user BOOL,
  engaged BOOL,
  engagement_time_msec INT64,
  page_views INT64,
  starter_views INT64,
  starter_generations INT64,
  starter_activations INT64,
  partner_views INT64,
  partner_clicks INT64,
  distinct_partners_clicked INT64,
  traffic_quality STRING
)
PARTITION BY session_date
CLUSTER BY hostname, source, country
OPTIONS (require_partition_filter = TRUE,
  description = 'One row per GA client/session. UTC session-start date. Rebuild recent partitions for late events.');

CREATE TEMP TABLE refreshed AS
WITH events AS (
  SELECT
    user_pseudo_id,
    (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ga_session_id') AS session_id,
    event_timestamp,
    event_name,
    geo.country,
    device.web_info.browser,
    session_traffic_source_last_click.cross_channel_campaign.source AS source,
    session_traffic_source_last_click.cross_channel_campaign.medium AS medium,
    session_traffic_source_last_click.cross_channel_campaign.default_channel_group AS default_channel_group,
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_location') AS page_location,
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_referrer') AS page_referrer,
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'partner_id') AS partner_id,
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'traffic_quality') AS traffic_quality,
    (SELECT COALESCE(value.int_value, SAFE_CAST(value.string_value AS INT64)) FROM UNNEST(event_params) WHERE key = 'session_engaged') AS session_engaged,
    (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'engagement_time_msec') AS engagement_time_msec
  FROM `tanstack-analytics.analytics_257297153.events_*`
  -- A day either side accommodates property-timezone boundaries.
  WHERE _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', DATE_SUB(start_date, INTERVAL 1 DAY))
    AND FORMAT_DATE('%Y%m%d', DATE_ADD(end_date, INTERVAL 1 DAY))
), sessions AS (
  SELECT DATE(TIMESTAMP_SECONDS(session_id), 'UTC') AS session_date,
    user_pseudo_id, session_id,
    TIMESTAMP_MICROS(MIN(event_timestamp)) AS first_event_at,
    TIMESTAMP_MICROS(MAX(event_timestamp)) AS last_event_at,
    ARRAY_AGG(STRUCT(NET.HOST(page_location) AS hostname,
      REGEXP_EXTRACT(page_location, r'^https?://[^/]+([^?#]*)') AS landing_path,
      NET.HOST(page_referrer) AS referrer_host, country, browser)
      ORDER BY event_timestamp LIMIT 1)[OFFSET(0)] AS entry,
    ARRAY_AGG(source IGNORE NULLS ORDER BY event_timestamp DESC LIMIT 1)[SAFE_OFFSET(0)] AS source,
    ARRAY_AGG(medium IGNORE NULLS ORDER BY event_timestamp DESC LIMIT 1)[SAFE_OFFSET(0)] AS medium,
    ARRAY_AGG(default_channel_group IGNORE NULLS ORDER BY event_timestamp DESC LIMIT 1)[SAFE_OFFSET(0)] AS default_channel_group,
    COUNTIF(event_name = 'first_visit') > 0 AS is_new_user,
    COUNTIF(session_engaged = 1) > 0 AS engaged,
    SUM(COALESCE(engagement_time_msec, 0)) AS engagement_time_msec,
    COUNTIF(event_name = 'page_view') AS page_views,
    COUNTIF(event_name = 'application_starter_viewed') AS starter_views,
    COUNTIF(event_name = 'application_starter_generated') AS starter_generations,
    COUNTIF(event_name = 'application_starter_activated') AS starter_activations,
    COUNTIF(event_name = 'partner_viewed') AS partner_views,
    COUNTIF(event_name = 'partner_clicked') AS partner_clicks,
    COUNT(DISTINCT IF(event_name = 'partner_clicked', partner_id, NULL)) AS distinct_partners_clicked,
    CASE
      WHEN COUNTIF(traffic_quality = 'automated') > 0 THEN 'automated'
      WHEN COUNTIF(traffic_quality = 'datacenter') > 0 THEN 'datacenter'
      WHEN COUNTIF(traffic_quality = 'suspect') > 0 THEN 'suspect'
      WHEN COUNTIF(traffic_quality = 'unflagged') > 0 THEN 'unflagged'
      ELSE 'unknown'
    END AS traffic_quality
  FROM events
  WHERE user_pseudo_id IS NOT NULL AND session_id IS NOT NULL
    AND DATE(TIMESTAMP_SECONDS(session_id), 'UTC') >= start_date
    AND DATE(TIMESTAMP_SECONDS(session_id), 'UTC') < end_date
  GROUP BY session_date, user_pseudo_id, session_id
)
SELECT session_date, user_pseudo_id, session_id, first_event_at, last_event_at,
  entry.hostname, entry.landing_path, entry.referrer_host,
  source, medium, default_channel_group,
  IF(source = 'search.brave.com', 'Organic Search', default_channel_group) AS channel_group,
  entry.country, entry.browser, is_new_user, engaged, engagement_time_msec,
  page_views, starter_views, starter_generations, starter_activations,
  partner_views, partner_clicks, distinct_partners_clicked,
  IF(distinct_partners_clicked >= 10, 'automated', traffic_quality) AS traffic_quality
FROM sessions;

-- Replacement is atomic. Never leave a partition empty after a failed scan.
BEGIN TRANSACTION;
DELETE FROM `tanstack-analytics.reporting.sessions`
WHERE session_date >= start_date AND session_date < end_date;
INSERT INTO `tanstack-analytics.reporting.sessions` SELECT * FROM refreshed;
COMMIT TRANSACTION;
