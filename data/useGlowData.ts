import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { GLOW_DATA } from './glowData';

export type GlowData = typeof GLOW_DATA;

const API_BASE_URL = 'https://glowfmradio.com/api';
const LIVEWIRE_HOME_URL = 'https://glowfmradio.com/';
const ACTIVE_POLL_INTERVAL_MS = 20000;
const BACKGROUND_POLL_INTERVAL_MS = 120000;
const REQUEST_TIMEOUT_MS = 12000;
const REMOTE_GLOW_DATA_URL = '';

const htmlUnescape = (value: string) =>
  value
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

const extractWireSnapshot = (html: string) => {
  const match = html.match(/wire:snapshot=\"([^\"]+)\"/);
  if (!match) return null;
  const decoded = htmlUnescape(match[1]);
  try {
    return JSON.parse(decoded);
  } catch (error) {
    console.warn('Failed to parse Livewire snapshot', error);
    return null;
  }
};

const stripLivewire = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    const cleaned = value
      .map(stripLivewire)
      .filter((item) => item !== undefined && item !== null);
    return cleaned;
  }
  if (value && typeof value === 'object') {
    if ('s' in value) {
      return undefined;
    }
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      const cleaned = stripLivewire(entry);
      if (cleaned !== undefined) {
        result[key] = cleaned;
      }
    }
    return result;
  }
  return value;
};

const unwrapSingleton = (entry: unknown) => {
  let current = entry;
  while (Array.isArray(current) && current.length === 1) {
    current = current[0];
  }
  return current;
};

const normalizeList = (value: unknown) => {
  if (!Array.isArray(value)) return [];
  const flattened = value.map(unwrapSingleton);
  if (flattened.length === 1 && Array.isArray(flattened[0])) {
    return (flattened[0] as unknown[]).map(unwrapSingleton);
  }
  return flattened;
};

const mapLatestNewsToPosts = (items: unknown[]) =>
  items
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const entry = item as Record<string, unknown>;
      const slug = typeof entry.slug === 'string' ? entry.slug : '';
      const link = typeof entry.link === 'string' ? entry.link : '';
      return {
        title: String(entry.title ?? ''),
        category: String(entry.category ?? ''),
        views: String(entry.views ?? ''),
        date: String(entry.date ?? entry.published_at ?? ''),
        read: String(entry.read_time ?? entry.read ?? ''),
        excerpt: String(entry.excerpt ?? ''),
        image: String(entry.image ?? ''),
        link: link || (slug ? `https://glowfmradio.com/news/${slug}` : ''),
      };
    })
    .filter(Boolean);

const mapLatestBlogToPosts = (items: unknown[]) =>
  items
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const entry = item as Record<string, unknown>;
      const slug = typeof entry.slug === 'string' ? entry.slug : '';
      const link = typeof entry.link === 'string' ? entry.link : '';
      return {
        title: String(entry.title ?? ''),
        category: String(entry.category ?? ''),
        views: String(entry.views ?? ''),
        date: String(entry.date ?? entry.published_at ?? ''),
        read: String(entry.read_time ?? entry.read ?? ''),
        excerpt: String(entry.excerpt ?? ''),
        author: String(entry.author ?? ''),
        authorRole: String(entry.authorRole ?? ''),
        image: String(entry.image ?? ''),
        link: link || (slug ? `https://glowfmradio.com/blog/${slug}` : ''),
      };
    })
    .filter(Boolean);

const mapLatestPodcasts = (items: unknown[]) =>
  items
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const entry = item as Record<string, unknown>;
      const slug = typeof entry.slug === 'string' ? entry.slug : '';
      const showSlug = typeof entry.show_slug === 'string' ? entry.show_slug : '';
      const link = typeof entry.link === 'string' ? entry.link : '';
      return {
        title: String(entry.title ?? ''),
        show: String(entry.show_title ?? entry.show ?? ''),
        duration: String(entry.duration ?? ''),
        date: String(entry.published_at ?? entry.date ?? ''),
        listens: String(entry.plays ?? entry.listens ?? ''),
        image: String(entry.image ?? ''),
        link:
          link || (slug && showSlug ? `https://glowfmradio.com/podcasts/${showSlug}/${slug}` : ''),
        description: String(entry.description ?? ''),
      };
    })
    .filter(Boolean);

const buildPatchFromSnapshot = (snapshot: Record<string, unknown>): Partial<GlowData> | null => {
  const rawData = snapshot.data ?? snapshot;
  const cleaned = stripLivewire(rawData);
  if (!cleaned || typeof cleaned !== 'object') return null;
  const source = cleaned as Record<string, unknown>;

  const heroSource = normalizeList(source.homeContent)[0] ?? {};
  const hero = heroSource && typeof heroSource === 'object' ? heroSource : {};
  const currentShowSource = normalizeList(source.currentShow)[0] ?? {};
  const currentShow = currentShowSource && typeof currentShowSource === 'object' ? currentShowSource : {};

  const stats = normalizeList(source.stats);
  const trendingNews = normalizeList(source.trendingNews);
  const featuredNews = normalizeList(source.featuredNews);
  const mostViewedNews = normalizeList(source.mostViewedNews);
  const latestNews = normalizeList(source.latestNews);
  const latestBlogPosts = normalizeList(source.latestBlogPosts);
  const latestPodcastEpisodes = normalizeList(source.latestPodcastEpisodes);
  const featuredShows = normalizeList(source.featuredShows);

  const newsPosts = mapLatestNewsToPosts(latestNews);
  const blogPosts = mapLatestBlogToPosts(latestBlogPosts);
  const podcasts = mapLatestPodcasts(latestPodcastEpisodes);

  return {
    home: {
      hero,
      currentShow,
      stats,
      trendingNews,
      featuredNews,
      mostViewedNews,
      otherNews: latestNews,
      latestNews,
      latestBlogPosts,
      latestPodcastEpisodes,
      featuredShows,
    },
    newsPosts,
    blogPosts,
    podcasts,
  };
};

const mergeGlowData = (base: GlowData, patch: Partial<GlowData>): GlowData => {
  const homePatch = patch.home ?? {};
  return {
    ...base,
    ...patch,
    home: {
      ...base.home,
      ...homePatch,
      hero: {
        ...base.home.hero,
        ...(homePatch.hero ?? {}),
      },
      currentShow: {
        ...base.home.currentShow,
        ...(homePatch.currentShow ?? {}),
      },
      stats: homePatch.stats?.length ? homePatch.stats : base.home.stats,
      trendingNews: homePatch.trendingNews?.length ? homePatch.trendingNews : base.home.trendingNews,
      featuredNews: homePatch.featuredNews?.length ? homePatch.featuredNews : base.home.featuredNews,
      mostViewedNews: homePatch.mostViewedNews?.length
        ? homePatch.mostViewedNews
        : base.home.mostViewedNews,
      otherNews: homePatch.otherNews?.length ? homePatch.otherNews : base.home.otherNews,
      latestNews: homePatch.latestNews?.length ? homePatch.latestNews : base.home.latestNews,
      latestBlogPosts: homePatch.latestBlogPosts?.length
        ? homePatch.latestBlogPosts
        : base.home.latestBlogPosts,
      latestPodcastEpisodes: homePatch.latestPodcastEpisodes?.length
        ? homePatch.latestPodcastEpisodes
        : base.home.latestPodcastEpisodes,
      featuredShows: homePatch.featuredShows?.length ? homePatch.featuredShows : base.home.featuredShows,
    },
    podcasts: patch.podcasts?.length ? patch.podcasts : base.podcasts,
    blogPosts: patch.blogPosts?.length ? patch.blogPosts : base.blogPosts,
    newsPosts: patch.newsPosts?.length ? patch.newsPosts : base.newsPosts,
  };
};

const withTimeout = async <T>(promiseFactory: (signal: AbortSignal) => Promise<T>): Promise<T> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await promiseFactory(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
};

const fetchJson = async (url: string): Promise<any | null> =>
  withTimeout(async (signal) => {
    const response = await fetch(url, { headers: { 'Cache-Control': 'no-cache' }, signal });
    if (!response.ok) return null;
    return response.json();
  });

const fetchRemoteJson = async (): Promise<Partial<GlowData> | null> => {
  if (!REMOTE_GLOW_DATA_URL) return null;
  const payload = await fetchJson(REMOTE_GLOW_DATA_URL);
  if (!payload || typeof payload !== 'object' || !('home' in payload)) return null;
  return payload as Partial<GlowData>;
};

const fetchLivewireHome = async (): Promise<Partial<GlowData> | null> => {
  return withTimeout(async (signal) => {
    const response = await fetch(LIVEWIRE_HOME_URL, {
      headers: { 'Cache-Control': 'no-cache' },
      signal,
    });
    if (!response.ok) return null;
    const html = await response.text();
    const snapshot = extractWireSnapshot(html);
    if (!snapshot || typeof snapshot !== 'object') return null;
    return buildPatchFromSnapshot(snapshot as Record<string, unknown>);
  });
};

const mapApiNewsCard = (item: Record<string, any>) => ({
  title: String(item.title ?? ''),
  category: String(item.category?.name ?? item.category ?? ''),
  views: String(item.views ?? ''),
  date: String(item.date ?? item.published_at ?? ''),
  read: String(item.read_time ?? item.read ?? ''),
  excerpt: String(item.excerpt ?? ''),
  image: String(item.image ?? item.featured_image ?? ''),
  link: item.link ?? (item.slug ? `https://glowfmradio.com/news/${item.slug}` : ''),
});

const mapApiBlogCard = (item: Record<string, any>) => ({
  title: String(item.title ?? ''),
  category: String(item.category?.name ?? item.category ?? ''),
  views: String(item.views ?? ''),
  date: String(item.date ?? item.published_at ?? ''),
  read: String(item.read_time ?? item.read ?? ''),
  excerpt: String(item.excerpt ?? ''),
  author: String(item.author ?? ''),
  authorRole: String(item.authorRole ?? item.author_role ?? ''),
  image: String(item.image ?? item.featured_image ?? ''),
  link: item.link ?? (item.slug ? `https://glowfmradio.com/blog/${item.slug}` : ''),
});

const mapApiEpisode = (item: Record<string, any>) => ({
  title: String(item.title ?? ''),
  show: String(item.show_title ?? item.show ?? ''),
  duration: String(item.duration ?? ''),
  date: String(item.published_at ?? item.date ?? ''),
  listens: String(item.plays ?? item.listens ?? ''),
  image: String(item.image ?? ''),
  link:
    item.link ??
    (item.slug && item.show_slug ? `https://glowfmradio.com/podcasts/${item.show_slug}/${item.slug}` : ''),
  description: String(item.description ?? ''),
  video_url: String(item.video_url ?? item.youtube_url ?? ''),
});

const mapApiFeaturedShow = (item: Record<string, any>) => ({
  title: String(item.title ?? ''),
  category: String(item.category ?? item.category?.name ?? 'Show'),
  duration: item.typical_duration ? `${item.typical_duration} mins` : '45 mins',
  host: String(item.host ?? item.primary_host?.name ?? 'Glow FM'),
  description: String(item.description ?? ''),
  status: item.is_featured ? 'Featured' : 'Live',
  url: item.slug ? `https://glowfmradio.com/shows/${item.slug}` : '',
});

const mapApiSchedule = (data: Record<string, any>) => {
  const schedule: Record<string, any[]> = {};
  Object.entries(data ?? {}).forEach(([day, slots]) => {
    const displayDay = (day as string)[0]?.toUpperCase()
      ? `${(day as string)[0].toUpperCase()}${(day as string).slice(1)}`
      : day;
    schedule[displayDay] = Array.isArray(slots)
      ? (slots as any[]).map((slot) => ({
          time: slot.time_range ?? `${slot.start_time ?? ''} - ${slot.end_time ?? ''}`.trim(),
          title: slot.show?.title ?? 'Glow FM',
          host: slot.host?.name ?? slot.show?.primary_host?.name ?? 'Glow FM',
          status: 'Live',
          url: slot.show?.slug ? `https://glowfmradio.com/shows/${slot.show.slug}` : '',
        }))
      : [];
  });
  return schedule;
};

const mapApiShows = (items: any[]) =>
  (items ?? []).map((show) => ({
    title: String(show.title ?? ''),
    category: String(show.category?.name ?? 'Show'),
    duration: show.typical_duration ? `${show.typical_duration} mins` : '45 mins',
    host: String(show.primary_host?.name ?? 'Glow FM'),
    description: String(show.description ?? ''),
    status: show.is_featured ? 'Featured' : 'Live',
    url: show.slug ? `https://glowfmradio.com/shows/${show.slug}` : '',
  }));

const mapApiShowCategories = (items: any[]) =>
  (items ?? []).map((item) => ({
    name: String(item.name ?? ''),
    count: Number(item.count ?? 0),
  }));

const mapApiHomePayload = (payload: Record<string, any>): Partial<GlowData> => {
  const hero = payload.homeContent ?? payload.home ?? {};
  const latestNews = Array.isArray(payload.latestNews) ? payload.latestNews.map(mapApiNewsCard) : [];
  const latestBlogPosts = Array.isArray(payload.latestBlogPosts)
    ? payload.latestBlogPosts.map(mapApiBlogCard)
    : [];
  const latestPodcastEpisodes = Array.isArray(payload.latestPodcastEpisodes)
    ? payload.latestPodcastEpisodes.map(mapApiEpisode)
    : [];

  return {
    home: {
      hero,
      currentShow: payload.currentShow
        ? {
            title: String(payload.currentShow.title ?? ''),
            slug: payload.currentShow.slug ?? '',
            host: payload.currentShow.host ?? '',
            host_slug: payload.currentShow.host_slug ?? '',
            time: payload.currentShow.time ?? '',
          }
        : undefined,
      stats: payload.stats ?? [],
      trendingNews: Array.isArray(payload.trendingNews)
        ? payload.trendingNews.map(mapApiNewsCard)
        : [],
      featuredNews: Array.isArray(payload.featuredNews)
        ? payload.featuredNews.map(mapApiNewsCard)
        : [],
      mostViewedNews: Array.isArray(payload.mostViewedNews)
        ? payload.mostViewedNews.map(mapApiNewsCard)
        : [],
      otherNews: Array.isArray(payload.otherNews)
        ? payload.otherNews.map(mapApiNewsCard)
        : latestNews,
      latestNews,
      latestBlogPosts,
      latestPodcastEpisodes,
      featuredShows: Array.isArray(payload.featuredShows)
        ? payload.featuredShows.map(mapApiFeaturedShow)
        : [],
      upcomingEvents: Array.isArray(payload.upcomingEvents) ? payload.upcomingEvents : [],
    },
    newsPosts: latestNews,
    blogPosts: latestBlogPosts,
    podcasts: latestPodcastEpisodes,
  };
};

const fetchApiBundle = async (): Promise<Partial<GlowData> | null> => {
  const [homePayload, schedulePayload, showsPayload] = await Promise.all([
    fetchJson(`${API_BASE_URL}/home`),
    fetchJson(`${API_BASE_URL}/schedule`),
    fetchJson(`${API_BASE_URL}/shows?per_page=9&sort=popular`),
  ]);

  const patch: Partial<GlowData> = {};

  if (homePayload && typeof homePayload === 'object') {
    Object.assign(patch, mapApiHomePayload(homePayload as Record<string, unknown>));
  }

  if (schedulePayload?.data) {
    patch.schedule = mapApiSchedule(schedulePayload.data);
  }

  if (Array.isArray(showsPayload?.data)) {
    patch.shows = mapApiShows(showsPayload.data);
  }

  if (Array.isArray(showsPayload?.meta?.categories)) {
    patch.showCategories = mapApiShowCategories(showsPayload.meta.categories);
  }

  return Object.keys(patch).length ? patch : null;
};

export const useGlowData = () => {
  const [data, setData] = useState<GlowData>(GLOW_DATA);
  const [isSyncing, setIsSyncing] = useState(false);
  const lastSyncRef = useRef(0);
  const syncLock = useRef(false);
  const appState = useRef(AppState.currentState);

  const sync = useCallback(
    async (force = false) => {
      if (syncLock.current) return;
      const interval =
        appState.current === 'active' ? ACTIVE_POLL_INTERVAL_MS : BACKGROUND_POLL_INTERVAL_MS;
      if (!force && Date.now() - lastSyncRef.current < interval) return;

      syncLock.current = true;
      setIsSyncing(true);
      try {
        const remotePayload = (await fetchApiBundle()) ?? (await fetchRemoteJson()) ?? (await fetchLivewireHome());
        if (remotePayload) {
          setData((prev) => mergeGlowData(prev, remotePayload));
          lastSyncRef.current = Date.now();
        }
      } catch (error) {
        console.warn('Glow data sync failed', error);
      } finally {
        syncLock.current = false;
        setIsSyncing(false);
      }
    },
    [],
  );

  useEffect(() => {
    sync(true);
    const subscription = AppState.addEventListener('change', (state) => {
      const prevState = appState.current;
      appState.current = state;
      if (prevState.match(/inactive|background/) && state === 'active') {
        sync(true);
      }
    });
    const interval = setInterval(() => {
      sync();
    }, ACTIVE_POLL_INTERVAL_MS);

    return () => {
      subscription.remove();
      clearInterval(interval);
    };
  }, [sync]);

  return { data, isSyncing, refresh: () => sync(true) };
};
