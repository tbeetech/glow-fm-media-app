
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  Image,
  LogBox,
  Linking,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { LinearGradient } from 'expo-linear-gradient';
import { Audio as ExpoAudio, AVPlaybackStatus } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGlowData } from './data/useGlowData';

const LOGO = require('./assets/logo.png');

type Station = {
  id: string;
  name: string;
  url: string;
  vibe: string;
  description: string;
  tags: string[];
};

const ZENO_STREAM_URL = 'https://stream-176.zeno.fm/mwam2yirv1pvv';
type WebAudioListener = { type: string; handler: EventListener };

const RADIO_STATIONS: Station[] = [
  {
    id: 'glow-991',
    name: 'GLOW 99.1 FM',
    url: ZENO_STREAM_URL,
    vibe: 'Live broadcast',
    description: 'Your Station, Your Voice â€” Akure, 24/7.',
    tags: ['99.1 FM', 'Akure', 'Live'],
  },
];

const SECTIONS = [
  'Home',
  'About',
  'Shows',
  'Schedule',
  'Podcasts',
  'News',
  'Blog',
  'Team',
  'OAPs',
  'Contact',
] as const;

type Section = (typeof SECTIONS)[number];

type AppErrorBoundaryState = {
  hasError: boolean;
  message: string;
};

const THEME = {
  colors: {
    background: '#16071f',
    surface: 'rgba(42, 14, 52, 0.7)',
    surfaceSoft: 'rgba(62, 21, 70, 0.56)',
    border: 'rgba(255, 159, 92, 0.28)',
    textPrimary: '#fff5ef',
    textSecondary: '#efd6fb',
    textMuted: '#c59ad8',
    accent: '#ff923e',
    accentDeep: '#8a3fd8',
    glow: '#ffc379',
    highlight: '#fff1e6',
    glass: 'rgba(31, 10, 42, 0.58)',
    glassStrong: 'rgba(51, 16, 64, 0.8)',
  },
  radius: {
    large: 22,
    medium: 16,
    small: 12,
  },
  fonts: {
    display: Platform.select({ ios: 'Avenir Next', android: 'sans-serif-medium', default: 'System' }),
    body: Platform.select({ ios: 'Avenir', android: 'sans-serif', default: 'System' }),
  },
};

const LIGHT_THEME: typeof THEME = {
  ...THEME,
  colors: {
    background: '#fff8f2',
    surface: 'rgba(255, 255, 255, 0.9)',
    surfaceSoft: 'rgba(255, 238, 226, 0.88)',
    border: 'rgba(125, 60, 184, 0.2)',
    textPrimary: '#2d123f',
    textSecondary: '#5a3671',
    textMuted: '#8966a1',
    accent: '#ef7d2f',
    accentDeep: '#7b35c9',
    glow: '#a245d6',
    highlight: '#ffffff',
    glass: 'rgba(255, 255, 255, 0.76)',
    glassStrong: 'rgba(255, 255, 255, 0.92)',
  },
};

type BackdropThemeConfig = {
  label: string;
  gradient: [string, string, string];
  orbPrimary: string;
  orbSecondary: string;
  ringStrong: string;
  ringMid: string;
  ringSoft: string;
  pulse: string;
};

type BackdropThemeKey = 'atlantic' | 'aurora';
type BackdropThemeMap = Record<BackdropThemeKey, BackdropThemeConfig>;

const BACKDROP_THEMES: BackdropThemeMap = {
  atlantic: {
    label: 'Sunset Pulse',
    gradient: ['#1a0623', '#3d0f3f', '#6c2a24'],
    orbPrimary: 'rgba(255, 134, 62, 0.28)',
    orbSecondary: 'rgba(178, 74, 255, 0.22)',
    ringStrong: 'rgba(255, 158, 84, 0.56)',
    ringMid: 'rgba(204, 110, 255, 0.45)',
    ringSoft: 'rgba(137, 69, 214, 0.34)',
    pulse: 'rgba(255, 199, 132, 0.82)',
  },
  aurora: {
    label: 'Violet Ember',
    gradient: ['#14031f', '#2d0b45', '#58201d'],
    orbPrimary: 'rgba(176, 94, 255, 0.28)',
    orbSecondary: 'rgba(255, 146, 72, 0.2)',
    ringStrong: 'rgba(190, 108, 255, 0.52)',
    ringMid: 'rgba(255, 153, 88, 0.44)',
    ringSoft: 'rgba(255, 210, 138, 0.28)',
    pulse: 'rgba(255, 181, 106, 0.84)',
  },
};

const LIGHT_BACKDROP_THEMES: BackdropThemeMap = {
  atlantic: {
    label: 'Sunset Pulse',
    gradient: ['#fff8f1', '#ffe9d5', '#fff4e8'],
    orbPrimary: 'rgba(255, 140, 64, 0.2)',
    orbSecondary: 'rgba(180, 92, 255, 0.16)',
    ringStrong: 'rgba(233, 122, 52, 0.34)',
    ringMid: 'rgba(171, 90, 246, 0.32)',
    ringSoft: 'rgba(214, 148, 255, 0.26)',
    pulse: 'rgba(241, 147, 71, 0.34)',
  },
  aurora: {
    label: 'Violet Ember',
    gradient: ['#fff7fb', '#f3e9ff', '#fff5ea'],
    orbPrimary: 'rgba(164, 96, 255, 0.17)',
    orbSecondary: 'rgba(255, 154, 84, 0.15)',
    ringStrong: 'rgba(151, 77, 235, 0.34)',
    ringMid: 'rgba(239, 134, 66, 0.31)',
    ringSoft: 'rgba(255, 189, 133, 0.25)',
    pulse: 'rgba(225, 118, 48, 0.34)',
  },
};

const resolveUrl = (url: string) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `https://glowfmradio.com${url}`;
};

const imageSource = (path?: string) => {
  const resolved = resolveUrl(path ?? '');
  return resolved ? { uri: resolved } : LOGO;
};

const STAFF_IMAGE_BY_SLUG: Record<string, string> = {
  'bose-owolabi': '/storage/uploads/staff/photos/Wv032m30hDZcDun8079SWehgfuJDFNJllT1wUYbx.jpg',
  'comfort-omolafe': '/storage/uploads/users/avatars/bzeeEBC2Wtk7D7YKvpArvEv8ZdQZk8dgRllH3VaX.jpg',
  mcolumiko: '/storage/uploads/oaps/photos/3II9v4HF1RG5RBZErEpxUJemmXvl23vsTKUSFz88.jpg',
};

const slugFromUrl = (url?: string) => {
  if (!url) return '';
  const clean = url.split('?')[0].replace(/\/+$/, '');
  const parts = clean.split('/');
  return parts[parts.length - 1]?.toLowerCase() ?? '';
};

const avatarSource = (name?: string) => ({
  uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'Glow FM')}&background=4b1c6d&color=fff4eb&size=400`,
});

const profileImageSource = (item: { image?: string; link?: string; name?: string }) => {
  if (item.image) return imageSource(item.image);
  const slug = slugFromUrl(item.link);
  const mapped = slug ? STAFF_IMAGE_BY_SLUG[slug] : '';
  if (mapped) return imageSource(mapped);
  return avatarSource(item.name);
};

const getEpisodeEmbedUrl = (url?: string) => {
  if (!url) return '';
  const fullUrl = url.trim();
  // Capture common YouTube ID patterns (watch, short, embed, share).
  const match =
    fullUrl.match(/[?&]v=([A-Za-z0-9_-]{6,11})/) ||
    fullUrl.match(/youtu\.be\/([A-Za-z0-9_-]{6,11})/) ||
    fullUrl.match(/embed\/([A-Za-z0-9_-]{6,11})/) ||
    fullUrl.match(/\/videos\/([A-Za-z0-9_-]{6,11})/);

  if (match && match[1]) {
    const id = match[1];
    return `https://www.youtube.com/embed/${id}?controls=1&playsinline=1&rel=0&modestbranding=1&autoplay=1`;
  }
  return '';
};

const getStationStreamUrls = () => [ZENO_STREAM_URL];

const formatPlaybackError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('503')) {
    return 'Live stream is temporarily unavailable (503). Please try again shortly.';
  }
  return 'Unable to start the live stream right now. Please try again.';
};

const IconSymbol = ({ name, color }: { name: 'radio' | 'pause' | 'play'; color: string }) => {
  if (name === 'radio') {
    return <Ionicons name="radio" size={22} color={color} />;
  }
  return (
    <Ionicons
      name={name === 'pause' ? 'pause' : 'play'}
      size={22}
      color={color}
      style={name === 'play' ? { marginLeft: 2 } : undefined}
    />
  );
};

class AppErrorBoundary extends React.Component<React.PropsWithChildren, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { hasError: true, message: error?.message || 'Unexpected runtime error' };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('App render failure:', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <SafeAreaView style={errorStyles.errorShell}>
        <Text style={errorStyles.errorTitle}>App failed to render</Text>
        <Text style={errorStyles.errorBody}>{this.state.message}</Text>
      </SafeAreaView>
    );
  }
}

const AppShell = (): JSX.Element => {
  const { data: glowData, isSyncing } = useGlowData();
  const [isLightMode, setIsLightMode] = useState(false);
  const theme = useMemo(() => (isLightMode ? LIGHT_THEME : THEME), [isLightMode]);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const backdropThemes = useMemo(
    () => (isLightMode ? LIGHT_BACKDROP_THEMES : BACKDROP_THEMES),
    [isLightMode],
  );
  const insets = useSafeAreaInsets();
  const rawInsetTop = Number.isFinite(insets.top) ? insets.top : 0;
  const safeInsetTop = Math.max(0, Math.min(48, rawInsetTop));
  const { width } = useWindowDimensions();
  const isWide = width >= 760;
  const isCompact = width <= 360;
  const heroTitleSize = isCompact ? 26 : isWide ? 34 : 30;
  const sectionTitleSize = isCompact ? 18 : isWide ? 22 : 20;
  const playButtonSize = isCompact ? 96 : isWide ? 140 : 120;
  const [backdropTheme, setBackdropTheme] = useState<BackdropThemeKey>('atlantic');

  const waveOne = useRef(new Animated.Value(0)).current;
  const waveTwo = useRef(new Animated.Value(0)).current;
  const waveThree = useRef(new Animated.Value(0)).current;
  const drift = useRef(new Animated.Value(0)).current;
  const sweepForward = useRef(new Animated.Value(0)).current;
  const sweepReverse = useRef(new Animated.Value(0)).current;
  const actionLock = useRef(false);
  const [selectedStation, setSelectedStation] = useState<Station>(RADIO_STATIONS[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackError, setPlaybackError] = useState('');
  const [activeSection, setActiveSection] = useState<Section>('Home');
  const [activeDay, setActiveDay] = useState<string>('Monday');
  const soundRef = useRef<ExpoAudio.Sound | null>(null);
  const webAudioRef = useRef<HTMLAudioElement | null>(null);
  const webAudioListeners = useRef<WebAudioListener[]>([]);
  const playStartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isStartingPlaybackRef = useRef(false);
  const isPlayingRef = useRef(false);
  const playPop = useRef(new Animated.Value(1)).current;
  const [expandedEpisodeId, setExpandedEpisodeId] = useState<string | null>(null);
  const playPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    LogBox.ignoreLogs(['[expo-av]: Expo AV has been deprecated']);
  }, []);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const easeInOutSin = useMemo(
    () =>
      Easing?.inOut && typeof Easing.sin === 'function'
        ? Easing.inOut(Easing.sin)
        : (t: number) => (1 - Math.cos(Math.PI * t)) / 2,
    [],
  );

  const easeInOutQuad = useMemo(
    () =>
      Easing?.inOut && typeof Easing.quad === 'function'
        ? Easing.inOut(Easing.quad)
        : (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
    [],
  );

  const linearEase = useMemo(
    () => (typeof Easing?.linear === 'function' ? Easing.linear : (t: number) => t),
    [],
  );
  const canUseNativeDriver = Platform.OS !== 'web';
  
  const playPulseScale = playPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] });
  const playPulseOpacity = playPulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0] });
  const playBeamOneScale = playPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.26] });
  const playBeamTwoScale = playPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.52] });
  const playBeamThreeScale = playPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.78] });
  const playBeamOneOpacity = playPulse.interpolate({ inputRange: [0, 1], outputRange: [0.42, 0] });
  const playBeamTwoOpacity = playPulse.interpolate({ inputRange: [0, 1], outputRange: [0.28, 0] });
  const playBeamThreeOpacity = playPulse.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0] });
  const playPopStyle = useMemo(
    () => ({
      transform: [{ scale: playPop }],
    }),
    [playPop],
  );

  const clearPlayStartTimeout = useCallback(() => {
    if (!playStartTimeoutRef.current) return;
    clearTimeout(playStartTimeoutRef.current);
    playStartTimeoutRef.current = null;
  }, []);

  const endPlaybackStartup = useCallback(() => {
    isStartingPlaybackRef.current = false;
    clearPlayStartTimeout();
    setIsLoading(false);
  }, [clearPlayStartTimeout]);

  const beginPlaybackStartup = useCallback(() => {
    isStartingPlaybackRef.current = true;
    clearPlayStartTimeout();
    setIsLoading(true);
    playStartTimeoutRef.current = setTimeout(() => {
      if (!isStartingPlaybackRef.current) return;
      isStartingPlaybackRef.current = false;
      setIsLoading(false);
      if (!isPlayingRef.current) {
        setPlaybackError('Stream took too long to start. Tap play again.');
      }
    }, 6500);
  }, [clearPlayStartTimeout]);

  const openExternal = useCallback((url?: string) => {
    if (!url) return;
    const resolved = resolveUrl(url);
    Linking.openURL(resolved).catch((err) => console.warn('External link failed:', err));
  }, []);

  const buildNewsUrl = (entry: any) =>
    entry?.link ||
    (entry?.slug ? `https://glowfmradio.com/news/${entry.slug}` : '');

  const scheduleDays = useMemo(() => Object.keys(glowData.schedule), [glowData.schedule]);
  const wallpaper = backdropThemes[backdropTheme];
  const sweepWidth = useMemo(() => Math.min(width * 1.4, 960), [width]);

  useEffect(() => {
    if (scheduleDays.length === 0) return;
    if (!activeDay || !scheduleDays.includes(activeDay)) {
      setActiveDay(scheduleDays[0]);
    }
  }, [activeDay, scheduleDays]);

  const handleStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      const statusError = 'error' in status ? status.error : undefined;
      if (statusError) {
        console.error('Playback error:', statusError);
        setPlaybackError(formatPlaybackError(statusError));
      }
      isStartingPlaybackRef.current = false;
      setIsPlaying(false);
      setIsLoading(false);
      return;
    }
    setPlaybackError('');
    setIsPlaying(status.isPlaying);
    if (status.isPlaying) {
      endPlaybackStartup();
      return;
    }
    setIsLoading(isStartingPlaybackRef.current ? status.isBuffering : false);
  }, [endPlaybackStartup]);

  const ensureWebAudio = useCallback(() => {
    if (Platform.OS !== 'web') return null;
    if (webAudioRef.current) return webAudioRef.current;
    if (typeof window === 'undefined' || typeof window.Audio !== 'function') return null;

    const audio = new window.Audio(ZENO_STREAM_URL);
    audio.crossOrigin = 'anonymous';
    audio.preload = 'none';

    const handlePlaying = () => {
      setIsPlaying(true);
      setIsLoading(false);
      setPlaybackError('');
    };
    const handlePause = () => setIsPlaying(false);
    const handleWaiting = () => setIsLoading(true);
    const handleStalled = () => setIsLoading(true);
    const handleError = () => {
      setIsPlaying(false);
      setIsLoading(false);
      setPlaybackError('Unable to start the live stream right now. Please try again.');
    };

    const listeners: WebAudioListener[] = [
      { type: 'playing', handler: handlePlaying },
      { type: 'pause', handler: handlePause },
      { type: 'waiting', handler: handleWaiting },
      { type: 'stalled', handler: handleStalled },
      { type: 'error', handler: handleError },
    ];

    listeners.forEach(({ type, handler }) => audio.addEventListener(type, handler));
    webAudioListeners.current = listeners;
    webAudioRef.current = audio;
    return audio;
  }, []);

  useEffect(() => {
    const configureAudio = async () => {
      try {
        await ExpoAudio.setAudioModeAsync({
          allowsRecordingIOS: false,
          staysActiveInBackground: true,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
      } catch (error) {
        console.warn('Audio mode setup failed:', error);
      }
    };

    configureAudio();

    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch((err) =>
          console.warn('Audio unload failed:', err),
        );
        soundRef.current = null;
      }
      clearPlayStartTimeout();
      if (webAudioRef.current) {
        webAudioListeners.current.forEach(({ type, handler }) =>
          webAudioRef.current?.removeEventListener(type, handler),
        );
        webAudioListeners.current = [];
        try {
          webAudioRef.current.pause();
          webAudioRef.current.src = '';
          webAudioRef.current.load?.();
        } catch {
          // ignore
        }
        webAudioRef.current = null;
      }
    };
  }, [clearPlayStartTimeout]);

  useEffect(() => {
    const makeWave = (anim: Animated.Value, duration: number, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration,
            easing: easeInOutSin,
            useNativeDriver: canUseNativeDriver,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration,
            easing: easeInOutSin,
            useNativeDriver: canUseNativeDriver,
          }),
        ]),
      );

    const waveAnimations = [
      makeWave(waveOne, 5200, 0),
      makeWave(waveTwo, 6400, 700),
      makeWave(waveThree, 7600, 1400),
    ];

    waveAnimations.forEach((animation) => animation.start());

    const driftAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: 12000,
          easing: easeInOutQuad,
          useNativeDriver: canUseNativeDriver,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: 12000,
          easing: easeInOutQuad,
          useNativeDriver: canUseNativeDriver,
        }),
      ]),
    );

    driftAnimation.start();

    return () => {
      waveAnimations.forEach((animation) => animation.stop());
      driftAnimation.stop();
    };
  }, [canUseNativeDriver, drift, easeInOutQuad, easeInOutSin, waveOne, waveTwo, waveThree]);

  useEffect(() => {
    const makeSweep = (anim: Animated.Value, delay: number, duration: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration,
            easing: linearEase,
            useNativeDriver: canUseNativeDriver,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: canUseNativeDriver,
          }),
        ]),
      );

    const sweepAnimations = [makeSweep(sweepForward, 600, 5200), makeSweep(sweepReverse, 1800, 6200)];
    sweepAnimations.forEach((animation) => animation.start());

    return () => {
      sweepAnimations.forEach((animation) => animation.stop());
    };
  }, [canUseNativeDriver, linearEase, sweepForward, sweepReverse]);

  useEffect(() => {
    let pulseLoop: Animated.CompositeAnimation | null = null;
    if (isPlaying && !isLoading) {
      playPulse.setValue(0);
      pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(playPulse, {
            toValue: 1,
            duration: 900,
            easing: linearEase,
            useNativeDriver: canUseNativeDriver,
          }),
          Animated.timing(playPulse, {
            toValue: 0,
            duration: 0,
            useNativeDriver: canUseNativeDriver,
          }),
        ]),
      );
      pulseLoop.start();
    } else {
      playPulse.stopAnimation();
      playPulse.setValue(0);
    }

    return () => {
      if (pulseLoop) pulseLoop.stop();
    };
  }, [canUseNativeDriver, isLoading, isPlaying, linearEase, playPulse]);

  const playStation = useCallback(
    async (station: Station) => {
      if (actionLock.current) return;
      actionLock.current = true;
      try {
        beginPlaybackStartup();
        setPlaybackError('');

        if (Platform.OS === 'web') {
          const audio = ensureWebAudio();
          if (!audio) {
            endPlaybackStartup();
            setPlaybackError('Unable to start the live stream right now. Please try again.');
            return;
          }
          audio.src = ZENO_STREAM_URL;
          try {
            const playResult = audio.play();
            if (playResult && typeof playResult.catch === 'function') {
              await playResult.catch((err: unknown) => {
                throw err;
              });
            }
            endPlaybackStartup();
            setIsPlaying(true);
            setPlaybackError('');
            return;
          } catch (err) {
            setPlaybackError(formatPlaybackError(err));
            endPlaybackStartup();
            setIsPlaying(false);
            return;
          }
        }

        if (station.id === selectedStation.id && soundRef.current) {
          try {
            const status = await soundRef.current.getStatusAsync();
            if (status.isLoaded && !status.isPlaying) {
              await soundRef.current.playAsync();
              const latestStatus = await soundRef.current.getStatusAsync();
              if (latestStatus.isLoaded && latestStatus.isPlaying) {
                endPlaybackStartup();
                setIsPlaying(true);
              }
              return;
            }
            if (status.isLoaded && status.isPlaying) {
              endPlaybackStartup();
              setIsPlaying(true);
              setIsLoading(false);
              return;
            }
          } catch (resumeError) {
            console.warn('Resume playback failed; reinitializing stream', resumeError);
            await soundRef.current.unloadAsync().catch(() => null);
            soundRef.current = null;
          }
        }

        setSelectedStation(station);

        if (soundRef.current) {
          await soundRef.current.unloadAsync();
          soundRef.current = null;
        }

        let lastError: unknown = null;
        const candidateUrls = getStationStreamUrls();
        for (const streamUrl of candidateUrls) {
          try {
            const initialStatus = {
              shouldPlay: true,
              progressUpdateIntervalMillis: 250,
            };
            const { sound, status } = await ExpoAudio.Sound.createAsync(
              { uri: streamUrl },
              initialStatus,
              handleStatusUpdate,
              false,
            );
            soundRef.current = sound;

            if (status.isLoaded) {
              await sound.setProgressUpdateIntervalAsync(250).catch(() => null);
              const latestStatus = await sound.getStatusAsync().catch(() => status);
              if (latestStatus.isLoaded) {
                setIsPlaying(latestStatus.isPlaying);
                if (latestStatus.isPlaying) {
                  endPlaybackStartup();
                }
              } else {
                endPlaybackStartup();
              }
              setPlaybackError('');
            } else {
              endPlaybackStartup();
            }
            return;
          } catch (attemptError) {
            lastError = attemptError;
          }
        }
        throw lastError ?? new Error('No playable stream URL');
      } catch (error) {
        console.error('Error playing station:', error);
        setPlaybackError(formatPlaybackError(error));
        endPlaybackStartup();
        setIsPlaying(false);
      } finally {
        actionLock.current = false;
      }
    },
    [beginPlaybackStartup, endPlaybackStartup, ensureWebAudio, handleStatusUpdate, selectedStation.id],
  );

  const togglePlayback = useCallback(async () => {
    if (actionLock.current) {
      return;
    }
    if (Platform.OS === 'web') {
      actionLock.current = true;
      try {
        const audio = ensureWebAudio();
        if (!audio) {
          setPlaybackError('Unable to start the live stream right now. Please try again.');
          return;
        }
        if (audio.paused) {
          beginPlaybackStartup();
          const playResult = audio.play();
          if (playResult && typeof playResult.catch === 'function') {
            await playResult.catch((err: unknown) => {
              throw err;
            });
          }
          endPlaybackStartup();
          setIsPlaying(true);
          setPlaybackError('');
        } else {
          audio.pause();
          endPlaybackStartup();
          setIsPlaying(false);
        }
        return;
      } catch (error) {
        console.error('Error toggling playback:', error);
        setPlaybackError(formatPlaybackError(error));
        endPlaybackStartup();
        setIsPlaying(false);
      } finally {
        actionLock.current = false;
      }
      return;
    }

    if (!soundRef.current) {
      await playStation(selectedStation);
      return;
    }

    actionLock.current = true;
    try {
      const status = await soundRef.current.getStatusAsync();
      if (!status.isLoaded) {
        actionLock.current = false;
        await playStation(selectedStation);
        return;
      }

      if (status.isPlaying) {
        await soundRef.current.pauseAsync();
        endPlaybackStartup();
        setIsPlaying(false);
      } else {
        beginPlaybackStartup();
        await soundRef.current.playAsync();
        const latestStatus = await soundRef.current.getStatusAsync();
        if (latestStatus.isLoaded && latestStatus.isPlaying) {
          endPlaybackStartup();
          setIsPlaying(true);
        }
      }
    } catch (error) {
      console.error('Error toggling playback:', error);
      setPlaybackError(formatPlaybackError(error));
      endPlaybackStartup();
      setIsPlaying(false);
    } finally {
      actionLock.current = false;
    }
  }, [beginPlaybackStartup, endPlaybackStartup, ensureWebAudio, playStation, selectedStation]);

  const handleLivePress = useCallback(async () => {
    await togglePlayback();
  }, [togglePlayback]);

  const triggerPlayPop = useCallback(() => {
    playPop.stopAnimation();
    playPop.setValue(1);
    Animated.sequence([
      Animated.timing(playPop, {
        toValue: 0.9,
        duration: 70,
        easing: easeInOutQuad,
        useNativeDriver: canUseNativeDriver,
      }),
      Animated.spring(playPop, {
        toValue: 1.08,
        useNativeDriver: canUseNativeDriver,
        speed: 22,
        bounciness: 7,
      }),
      Animated.spring(playPop, {
        toValue: 1,
        useNativeDriver: canUseNativeDriver,
        speed: 18,
        bounciness: 6,
      }),
    ]).start();
  }, [canUseNativeDriver, easeInOutQuad, playPop]);

  const handleLivePressWithPop = useCallback(async () => {
    triggerPlayPop();
    await handleLivePress();
  }, [handleLivePress, triggerPlayPop]);

  const hero = glowData.home.hero;
  const currentShow = glowData.home.currentShow;
  const stats = glowData.home.stats;
  const trendingNews = glowData.home.trendingNews;
  const featuredShows = glowData.home.featuredShows;
  const latestNews = glowData.home.otherNews.length
    ? glowData.home.otherNews
    : glowData.newsPosts;
  const blogPosts = glowData.blogPosts;
  const podcasts = glowData.podcasts;
  const about = glowData.about;

  const latestNewsPreview = useMemo(() => latestNews.slice(0, 3), [latestNews]);

  const cardGridStyle = useMemo(
    () => [styles.cardGrid, isWide && styles.cardGridWide],
    [isWide],
  );

  const waveOneStyle = {
    opacity: waveOne.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.85] }),
    transform: [
      { scale: waveOne.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.15] }) },
      { rotate: waveOne.interpolate({ inputRange: [0, 1], outputRange: ['-8deg', '14deg'] }) },
    ],
  };
  const waveTwoStyle = {
    opacity: waveTwo.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.75] }),
    transform: [
      { scale: waveTwo.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.2] }) },
      { rotate: waveTwo.interpolate({ inputRange: [0, 1], outputRange: ['12deg', '-12deg'] }) },
    ],
  };
  const waveThreeStyle = {
    opacity: waveThree.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.6] }),
    transform: [
      { scale: waveThree.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1.25] }) },
      { rotate: waveThree.interpolate({ inputRange: [0, 1], outputRange: ['-16deg', '10deg'] }) },
    ],
  };

  const sweepForwardStyle = {
    opacity: sweepForward.interpolate({ inputRange: [0, 0.15, 0.7, 1], outputRange: [0, 0.55, 0.9, 0] }),
    transform: [
      {
        translateX: sweepForward.interpolate({
          inputRange: [0, 1],
          outputRange: [-sweepWidth, sweepWidth],
        }),
      },
      { translateY: -6 },
    ],
  };

  const sweepReverseStyle = {
    opacity: sweepReverse.interpolate({ inputRange: [0, 0.2, 0.75, 1], outputRange: [0, 0.5, 0.85, 0] }),
    transform: [
      {
        translateX: sweepReverse.interpolate({
          inputRange: [0, 1],
          outputRange: [sweepWidth, -sweepWidth],
        }),
      },
      { translateY: 12 },
    ],
  };

  const glowDriftStyle = {
    transform: [
      {
        translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [0, 14] }),
      },
      {
        translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [0, -12] }),
      },
    ],
  };

  const glowDriftAltStyle = {
    transform: [
      {
        translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [0, -18] }),
      },
      {
        translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [0, 18] }),
      },
    ],
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar
        barStyle={isLightMode ? 'dark-content' : 'light-content'}
        backgroundColor={theme.colors.background}
      />

      <View
        style={[
          styles.atlanticBackdrop,
          { height: 360 + safeInsetTop, top: -safeInsetTop, pointerEvents: 'none' },
        ]}
      >
        <LinearGradient
          colors={wallpaper.gradient}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={styles.atlanticGradient}
        />
        <Animated.View
          style={[
            styles.depthOrb,
            glowDriftStyle,
            { backgroundColor: wallpaper.orbPrimary, shadowColor: wallpaper.ringStrong },
          ]}
        />
        <Animated.View
          style={[
            styles.depthOrbSecondary,
            glowDriftAltStyle,
            { backgroundColor: wallpaper.orbSecondary, shadowColor: wallpaper.ringMid },
          ]}
        />
        <Animated.View
          style={[
            styles.waveRing,
            styles.waveRingOne,
            { borderColor: wallpaper.ringStrong, shadowColor: wallpaper.ringStrong },
            waveOneStyle,
          ]}
        />
        <Animated.View
          style={[
            styles.waveRing,
            styles.waveRingTwo,
            { borderColor: wallpaper.ringMid, shadowColor: wallpaper.ringMid },
            waveTwoStyle,
          ]}
        />
        <Animated.View
          style={[
            styles.waveRing,
            styles.waveRingThree,
            { borderColor: wallpaper.ringSoft, shadowColor: wallpaper.ringSoft },
            waveThreeStyle,
          ]}
        />
        <Animated.View
          style={[
            styles.radioSweep,
            { width: sweepWidth, backgroundColor: wallpaper.pulse, shadowColor: wallpaper.pulse },
            sweepForwardStyle,
          ]}
        />
        <Animated.View
          style={[
            styles.radioSweep,
            styles.radioSweepAlt,
            { width: sweepWidth * 0.9, backgroundColor: wallpaper.ringMid, shadowColor: wallpaper.ringMid },
            sweepReverseStyle,
          ]}
        />
        <View style={[styles.depthHorizon, { backgroundColor: wallpaper.ringSoft }]} />
      </View>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.logoMark}>
                <Image source={LOGO} style={styles.logoMarkImage} resizeMode="contain" />
              </View>
              <View style={styles.headerCopy}>
                <Text style={[styles.title, isWide && styles.titleWide]}>Glow 99.1 FM</Text>
                <Text style={styles.subtitle}>City heartbeat, live.</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.modeSwitch}
              onPress={() => setIsLightMode((current) => !current)}
              activeOpacity={0.85}
              accessibilityRole="switch"
              accessibilityLabel="Toggle light mode"
              accessibilityState={{ checked: isLightMode }}
            >
              <View style={[styles.modeSwitchTrack, isLightMode && styles.modeSwitchTrackActive]}>
                <View style={[styles.modeSwitchDot, isLightMode && styles.modeSwitchDotActive]} />
              </View>
            </TouchableOpacity>
          </View>
          <View style={styles.syncRow}>
            <View style={[styles.syncDot, isSyncing && styles.syncDotActive]} />
            <Text style={styles.syncText}>{isSyncing ? 'Syncing live' : 'Live sync ready'}</Text>
          </View>
          <View style={styles.themeRow}>
            {Object.entries(backdropThemes).map(([key, entry]) => {
              const active = backdropTheme === key;
              return (
                <TouchableOpacity
                  key={key}
                  onPress={() => setBackdropTheme(key as BackdropThemeKey)}
                  hitSlop={8}
                  activeOpacity={0.85}
                  style={[styles.themeChip, active && styles.themeChipActive]}
                >
                  <Text style={[styles.themeChipText, active && styles.themeChipTextActive]}>
                    {entry.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <FlatList
            horizontal
            data={SECTIONS}
            keyExtractor={(item) => item}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabRow}
            renderItem={({ item: section }) => {
              const active = activeSection === section;
              return (
                <TouchableOpacity
                  key={section}
                  onPress={() => setActiveSection(section)}
                  activeOpacity={0.85}
                  hitSlop={{ top: 8, bottom: 8, left: 10, right: 10 }}
                  style={[styles.tabChip, active && styles.tabChipActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>{section}</Text>
                </TouchableOpacity>
              );
            }}
          />

          {activeSection === 'Home' && (
            <View>
              <View style={styles.heroCard}>
                <View style={styles.heroLogoRow}>
                  <Image source={LOGO} style={styles.heroLogo} resizeMode="contain" />
                  <View>
                    <Text style={styles.heroLogoText}>Glow 99.1 FM</Text>
                    <Text style={styles.heroLogoSub}>Akure • Live • 99.1 FM</Text>
                  </View>
                </View>
                <Text style={styles.heroBadge}>{hero.hero_badge}</Text>
                <Text style={[styles.heroTitle, { fontSize: heroTitleSize }]}>
                  {hero.hero_title}{' '}
                  <Text style={styles.heroHighlight}>{hero.hero_highlight}</Text>
                </Text>
                <Text style={styles.heroCopy}>{hero.hero_subtitle}</Text>
                <View style={styles.heroActions}>
                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={handleLivePress}
                    accessibilityRole="button"
                    accessibilityLabel="Listen live now"
                    accessibilityState={{ busy: isLoading }}
                  >
                    <Text style={styles.primaryButtonText}>
                      {isPlaying ? 'Pause Live' : hero.primary_cta_text}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={() => setActiveSection('Schedule')}
                    accessibilityRole="button"
                    accessibilityLabel="View schedule"
                  >
                    <Text style={styles.secondaryButtonText}>{hero.secondary_cta_text}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.nowPlayingCard} accessible accessibilityLabel="Now playing">
                <Text style={styles.cardLabel}>{hero.now_playing_label || 'Currently Playing'}</Text>
                <Text style={styles.stationName}>
                  {currentShow.title || 'No show scheduled'}
                </Text>
                <Text style={styles.stationVibe}>
                  {currentShow.host ? `with ${currentShow.host}` : 'Glow FM'}
                </Text>
                <Text style={styles.stationDescription}>
                  {currentShow.time || 'Live across Akure on 99.1 FM'}
                </Text>
              </View>

              <View style={styles.controls}>
                <TouchableOpacity
                  style={[
                    styles.playButton,
                    {
                      width: playButtonSize,
                      height: playButtonSize,
                      borderRadius: playButtonSize / 2,
                    },
                    isPlaying && styles.playButtonActive,
                    playPopStyle,
                  ]}
                  onPress={handleLivePressWithPop}
                  activeOpacity={0.88}
                  hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
                  accessibilityRole="button"
                  accessibilityLabel={isPlaying ? 'Pause playback' : 'Start playback'}
                  accessibilityHint="Double tap to toggle the live stream"
                  accessibilityState={{ busy: isLoading }}
                >
                  {isLoading ? (
                    <ActivityIndicator size="large" color={theme.colors.highlight} />
                  ) : (
                    <>
                      {isPlaying && (
                        <>
                          <Animated.View
                            style={[
                              styles.playButtonGlow,
                              {
                                pointerEvents: 'none',
                                opacity: playPulseOpacity,
                                transform: [{ scale: playPulseScale }],
                              },
                            ]}
                          />
                          <Animated.View
                            style={[
                              styles.playBeam,
                              {
                                pointerEvents: 'none',
                                opacity: playBeamOneOpacity,
                                transform: [{ scale: playBeamOneScale }],
                              },
                            ]}
                          />
                          <Animated.View
                            style={[
                              styles.playBeam,
                              styles.playBeamMid,
                              {
                                pointerEvents: 'none',
                                opacity: playBeamTwoOpacity,
                                transform: [{ scale: playBeamTwoScale }],
                              },
                            ]}
                          />
                          <Animated.View
                            style={[
                              styles.playBeam,
                              styles.playBeamOuter,
                              {
                                pointerEvents: 'none',
                                opacity: playBeamThreeOpacity,
                                transform: [{ scale: playBeamThreeScale }],
                              },
                            ]}
                          />
                        </>
                      )}
                      <View style={styles.playButtonCore}>
                        <Ionicons
                          name={isPlaying ? 'pause' : 'play'}
                          size={34}
                          color={theme.colors.highlight}
                          style={!isPlaying ? styles.playIconOffset : undefined}
                        />
                      </View>
                    </>
                  )}
                </TouchableOpacity>
                <Text style={styles.controlHint}>
                  Tap to {isPlaying ? 'pause the live stream' : 'start the live stream'}
                </Text>
                {playbackError ? <Text style={styles.controlError}>{playbackError}</Text> : null}
              </View>
              <View style={styles.sectionCard}>
                <Text style={[styles.sectionTitle, { fontSize: sectionTitleSize }]}>Glow FM By The Numbers</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.statScroll}
                >
                  {stats.map((item) => (
                    <View key={item.label} style={[styles.statItem, styles.statItemWide]}>
                      <Text style={styles.statNumber}>{item.number}</Text>
                      <Text style={styles.statLabel}>{item.label}</Text>
                    </View>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.sectionCard}>
                <Text style={[styles.sectionTitle, { fontSize: sectionTitleSize }]}>Trending</Text>
                <FlatList
                  data={trendingNews}
                  keyExtractor={(item) => item.slug ?? item.title}
                  scrollEnabled={false}
                  contentContainerStyle={styles.trendingList}
                  renderItem={({ item }) => (
                    <View style={styles.trendingItem}>
                      <Text style={styles.trendingTitle}>{item.title}</Text>
                      <Text style={styles.trendingMeta}>
                        {item.category} • {item.views} views
                      </Text>
                    </View>
                  )}
                />
              </View>

              <View style={styles.sectionCard}>
                <Text style={[styles.sectionTitle, { fontSize: sectionTitleSize }]}>Latest News</Text>
                <FlatList
                  data={latestNewsPreview}
                  key={`latest-news-${isWide ? 'wide' : 'compact'}`}
                  keyExtractor={(item) => item.slug ?? item.title}
                  numColumns={isWide ? 2 : 1}
                  scrollEnabled={false}
                  contentContainerStyle={cardGridStyle}
                  columnWrapperStyle={isWide ? styles.cardRow : undefined}
                  renderItem={({ item: news }) => (
                    <TouchableOpacity
                      activeOpacity={0.9}
                      onPress={() => openExternal(buildNewsUrl(news))}
                      style={[styles.mediaCard, isWide && styles.mediaCardWide]}
                    >
                      <Image
                        source={imageSource(news.image)}
                        style={styles.mediaImage}
                        resizeMode="cover"
                      />
                      <View style={styles.mediaBody}>
                        <Text style={styles.mediaCategory}>{news.category}</Text>
                        <Text style={styles.mediaTitle}>{news.title}</Text>
                        <Text style={styles.mediaMeta}>{news.date} • {news.read_time}</Text>
                        <Text style={styles.mediaExcerpt} numberOfLines={3}>
                          {news.excerpt}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}
                />
              </View>

              <View style={styles.sectionCard}>
                <Text style={[styles.sectionTitle, { fontSize: sectionTitleSize }]}>Featured Shows</Text>
                <FlatList
                  data={featuredShows}
                  keyExtractor={(item) => item.slug ?? item.title}
                  scrollEnabled={false}
                  renderItem={({ item: show }) => (
                    <TouchableOpacity
                      activeOpacity={0.9}
                      onPress={() => openExternal((show as any).url || (show as any).link)}
                      style={styles.featureCard}
                    >
                      <Image
                        source={imageSource(show.image)}
                        style={styles.featureImage}
                        resizeMode="cover"
                      />
                      <View style={styles.featureBody}>
                        <Text style={styles.mediaCategory}>{show.category}</Text>
                        <Text style={styles.featureTitle}>{show.title}</Text>
                        <Text style={styles.featureMeta}>{show.time} • {show.host}</Text>
                        <Text style={styles.mediaExcerpt} numberOfLines={3}>{show.description}</Text>
                      </View>
                    </TouchableOpacity>
                  )}
                />
              </View>

              <View style={styles.sectionCard}>
                <Text style={[styles.sectionTitle, { fontSize: sectionTitleSize }]}>Latest Podcasts</Text>
                <FlatList
                  data={podcasts}
                  keyExtractor={(item) => item.link ?? item.title}
                  scrollEnabled={false}
                  renderItem={({ item: episode }) => (
                    <TouchableOpacity
                      activeOpacity={0.9}
                      onPress={() => openExternal(episode.link)}
                      style={styles.listCard}
                    >
                      <Image
                        source={imageSource(episode.image)}
                        style={styles.thumbImage}
                        resizeMode="cover"
                      />
                      <View style={styles.listBody}>
                        <Text style={styles.mediaCategory}>{episode.show}</Text>
                        <Text style={styles.mediaTitle}>{episode.title}</Text>
                        <Text style={styles.mediaMeta}>
                          {episode.date} • {episode.duration} • {episode.listens} plays
                        </Text>
                        {episode.description ? (
                          <Text style={styles.mediaExcerpt} numberOfLines={2}>
                            {episode.description}
                          </Text>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  )}
                />
              </View>

              <View style={styles.sectionCard}>
                <Text style={[styles.sectionTitle, { fontSize: sectionTitleSize }]}>Latest Blog Posts</Text>
                <FlatList
                  data={blogPosts}
                  keyExtractor={(item) => item.link ?? item.title}
                  scrollEnabled={false}
                  renderItem={({ item: post }) => (
                    <TouchableOpacity
                      activeOpacity={0.9}
                      onPress={() => openExternal(post.link)}
                      style={styles.listCard}
                    >
                      <Image
                        source={imageSource(post.image)}
                        style={styles.thumbImage}
                        resizeMode="cover"
                      />
                      <View style={styles.listBody}>
                        <Text style={styles.mediaCategory}>{post.category}</Text>
                        <Text style={styles.mediaTitle}>{post.title}</Text>
                        <Text style={styles.mediaMeta}>
                          {post.date} • {post.read} • {post.views} views
                        </Text>
                        <Text style={styles.mediaExcerpt} numberOfLines={3}>
                          {post.excerpt}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}
                />
              </View>

              <View style={styles.sectionCard}>
                <Text style={[styles.sectionTitle, { fontSize: sectionTitleSize }]}>Upcoming Events</Text>
                <Text style={styles.sectionCopy}>
                  {glowData.home.upcomingEvents.length === 0
                    ? 'No upcoming events at the moment.'
                    : 'Check back soon for updates.'}
                </Text>
              </View>
            </View>
          )}

          {activeSection === 'About' && (
            <View>
              <View style={styles.heroCard}>
                <Text style={[styles.sectionTitle, { fontSize: sectionTitleSize }]}>{about.header_title}</Text>
                <Text style={styles.heroCopy}>{about.header_subtitle}</Text>
              </View>

              <View style={styles.sectionCard}>
                <Text style={[styles.sectionTitle, { fontSize: sectionTitleSize }]}>{about.story_title}</Text>
                <FlatList
                  data={about.story_paragraphs.filter(Boolean)}
                  keyExtractor={(item, index) => `${item}-${index}`}
                  scrollEnabled={false}
                  renderItem={({ item }) => (
                    <Text style={styles.sectionCopy}>
                      {item}
                    </Text>
                  )}
                />
                <FlatList
                  data={about.story_badges}
                  key={`story-badges-${isWide ? 'wide' : 'compact'}`}
                  keyExtractor={(item) => item}
                  numColumns={isWide ? 3 : 2}
                  scrollEnabled={false}
                  contentContainerStyle={styles.badgeRow}
                  columnWrapperStyle={styles.badgeRowColumn}
                  renderItem={({ item: badge }) => (
                    <View style={styles.badgeChip}>
                      <Text style={styles.badgeText}>{badge}</Text>
                    </View>
                  )}
                />
              </View>

              <View style={styles.sectionCard}>
                <Text style={[styles.sectionTitle, { fontSize: sectionTitleSize }]}>{about.mission_title}</Text>
                <Text style={styles.sectionCopy}>{about.mission_body}</Text>
              </View>

              <View style={styles.sectionCard}>
                <Text style={[styles.sectionTitle, { fontSize: sectionTitleSize }]}>{about.vision_title}</Text>
                <Text style={styles.sectionCopy}>{about.vision_body}</Text>
              </View>

              <View style={styles.sectionCard}>
                <Text style={[styles.sectionTitle, { fontSize: sectionTitleSize }]}>{about.values_title}</Text>
                <Text style={styles.sectionCopy}>{about.values_subtitle}</Text>
                <FlatList
                  data={about.values}
                  key={`about-values-${isWide ? 'wide' : 'compact'}`}
                  keyExtractor={(item) => item.title}
                  numColumns={isWide ? 2 : 1}
                  scrollEnabled={false}
                  contentContainerStyle={cardGridStyle}
                  columnWrapperStyle={isWide ? styles.cardRow : undefined}
                  renderItem={({ item: value }) => (
                    <View style={styles.valueCard}>
                      <Text style={styles.valueTitle}>{value.title}</Text>
                      <Text style={styles.valueCopy}>{value.description}</Text>
                    </View>
                  )}
                />
              </View>

              <View style={styles.sectionCard}>
                <Text style={[styles.sectionTitle, { fontSize: sectionTitleSize }]}>{about.milestones_title}</Text>
                <Text style={styles.sectionCopy}>{about.milestones_subtitle}</Text>
                <FlatList
                  data={about.milestones}
                  keyExtractor={(item) => `${item.year}-${item.title}`}
                  scrollEnabled={false}
                  renderItem={({ item: milestone }) => (
                    <View style={styles.milestoneItem}>
                      <Text style={styles.milestoneYear}>{milestone.year}</Text>
                      <View style={styles.milestoneBody}>
                        <Text style={styles.milestoneTitle}>{milestone.title}</Text>
                        <Text style={styles.sectionCopy}>{milestone.description}</Text>
                      </View>
                    </View>
                  )}
                />
              </View>

              <View style={styles.sectionCard}>
                <Text style={[styles.sectionTitle, { fontSize: sectionTitleSize }]}>{about.team_title}</Text>
                <Text style={styles.sectionCopy}>{about.team_subtitle}</Text>
                <FlatList
                  data={about.team}
                  keyExtractor={(item) => item.name}
                  scrollEnabled={false}
                  renderItem={({ item: leader }) => (
                    <View style={styles.listCard}>
                      <Image
                        source={imageSource(leader.image)}
                        style={styles.thumbImage}
                        resizeMode="cover"
                      />
                      <View style={styles.listBody}>
                        <Text style={styles.mediaTitle}>{leader.name}</Text>
                        <Text style={styles.mediaCategory}>{leader.position}</Text>
                        <Text style={styles.mediaExcerpt} numberOfLines={6}>
                          {leader.bio}
                        </Text>
                        {leader.social && leader.social[0] && leader.social[0].email ? (
                          <Text style={styles.mediaMeta}>{leader.social[0].email}</Text>
                        ) : null}
                      </View>
                    </View>
                  )}
                />
              </View>

              <View style={styles.sectionCard}>
                <Text style={[styles.sectionTitle, { fontSize: sectionTitleSize }]}>{about.achievements_title}</Text>
                <Text style={styles.sectionCopy}>{about.achievements_subtitle}</Text>
                {about.achievements.map((achievement) => (
                  <View key={achievement.award} style={styles.listRow}>
                    <Text style={styles.mediaTitle}>{achievement.award}</Text>
                    <Text style={styles.mediaMeta}>
                      {achievement.organization} • {achievement.year}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={styles.sectionCard}>
                <Text style={[styles.sectionTitle, { fontSize: sectionTitleSize }]}>{about.stats_title}</Text>
                <Text style={styles.sectionCopy}>{about.stats_subtitle}</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.statScroll}
                >
                  {about.stats.map((stat) => (
                    <View key={stat.label} style={[styles.statItem, styles.statItemWide]}>
                      <Text style={styles.statNumber}>{stat.number}</Text>
                      <Text style={styles.statLabel}>{stat.label}</Text>
                    </View>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.sectionCard}>
                <Text style={[styles.sectionTitle, { fontSize: sectionTitleSize }]}>{about.cta_title}</Text>
                <Text style={styles.sectionCopy}>{about.cta_body}</Text>
              </View>
            </View>
          )}

          {activeSection === 'Shows' && (
            <View>
              <View style={styles.sectionCard}>
                <Text style={[styles.sectionTitle, { fontSize: sectionTitleSize }]}>Show Categories</Text>
                <View style={styles.badgeRow}>
                  {glowData.showCategories.map((cat) => (
                    <View key={cat.name} style={styles.badgeChip}>
                      <Text style={styles.badgeText}>{cat.name} ({cat.count})</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.sectionCard}>
                <Text style={[styles.sectionTitle, { fontSize: sectionTitleSize }]}>Shows & Programs</Text>
                {glowData.shows.map((show) => (
                  <View key={show.url} style={styles.listRow}>
                    <View style={styles.listBody}>
                      <Text style={styles.mediaTitle}>{show.title}</Text>
                      <Text style={styles.mediaCategory}>{show.category}</Text>
                      <Text style={styles.mediaMeta}>
                        {show.duration} • {show.host} • {show.status}
                      </Text>
                      <Text style={styles.mediaExcerpt} numberOfLines={3}>
                        {show.description}
                      </Text>
                    </View>
                  </View>
                ))}
                <Text style={styles.sectionCopy}>
                  Showing 9 of {glowData.showCategories.find((c) => c.name === 'All Shows')?.count ?? 101} shows.
                </Text>
              </View>
            </View>
          )}

          {activeSection === 'Schedule' && (
            <View>
              <View style={styles.sectionCard}>
                <Text style={[styles.sectionTitle, { fontSize: sectionTitleSize }]}>Weekly Schedule</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.tabRow}
                >
                  {scheduleDays.map((day) => {
                    const active = activeDay === day;
                    return (
                      <TouchableOpacity
                        key={day}
                        onPress={() => setActiveDay(day)}
                        style={[styles.tabChip, active && styles.tabChipActive]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                      >
                        <Text style={[styles.tabText, active && styles.tabTextActive]}>{day}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                <View style={styles.scheduleList}>
                  {glowData.schedule[activeDay]?.map((item, index) => (
                    <View key={`${item.title}-${index}`} style={styles.scheduleItem}>
                      <View style={styles.scheduleCopy}>
                        <Text style={styles.mediaTitle}>{item.title}</Text>
                        <Text style={styles.mediaMeta}>{item.time}</Text>
                        <Text style={styles.mediaMeta}>{item.host}</Text>
                      </View>
                      <View style={styles.statusPill}>
                        <Text style={styles.statusText}>{item.status}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          )}

          {activeSection === 'Podcasts' && (
            <View style={styles.sectionCard}>
              <Text style={[styles.sectionTitle, { fontSize: sectionTitleSize }]}>Podcast Episodes</Text>
              {podcasts.map((episode) => {
                const embedUrl = getEpisodeEmbedUrl((episode as any).video_url || episode.link);
                const episodeId = episode.link || episode.title;
                const isExpanded = expandedEpisodeId === episodeId;

                const handleEpisodePress = () => {
                  if (embedUrl) {
                    setExpandedEpisodeId(isExpanded ? null : episodeId);
                  } else if (episode.link) {
                    Linking.openURL(resolveUrl(episode.link)).catch(() => null);
                  }
                };

                return (
                  <TouchableOpacity
                    key={episode.link ?? episode.title}
                    style={[styles.listCard, isExpanded && styles.listCardExpanded]}
                    activeOpacity={0.9}
                    onPress={handleEpisodePress}
                  >
                    <Image
                      source={imageSource(episode.image)}
                      style={styles.thumbImage}
                      resizeMode="cover"
                    />
                    <View style={styles.listBody}>
                      <Text style={styles.mediaCategory}>{episode.show}</Text>
                      <Text style={styles.mediaTitle}>{episode.title}</Text>
                      <Text style={styles.mediaMeta}>
                        {episode.date} • {episode.duration} • {episode.listens} plays
                      </Text>
                      {episode.description ? (
                        <Text style={styles.mediaExcerpt} numberOfLines={2}>
                          {episode.description}
                        </Text>
                      ) : null}
                      {embedUrl && isExpanded ? (
                        <View style={styles.embedCard}>
                          <WebView
                            source={{ uri: embedUrl }}
                            allowsInlineMediaPlayback
                            allowsFullscreenVideo
                            mediaPlaybackRequiresUserAction={false}
                            javaScriptEnabled
                            androidLayerType="hardware"
                            originWhitelist={['*']}
                            startInLoadingState
                            scrollEnabled={false}
                            style={styles.embedWebView}
                            onError={(e) => console.warn('Podcast embed failed', e.nativeEvent)}
                          />
                        </View>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {activeSection === 'News' && (
            <View style={styles.sectionCard}>
              <Text style={[styles.sectionTitle, { fontSize: sectionTitleSize }]}>News & Updates</Text>
              {glowData.newsPosts.map((news) => (
                <TouchableOpacity
                  key={news.link}
                  activeOpacity={0.9}
                  onPress={() => openExternal(buildNewsUrl(news))}
                  style={styles.mediaCard}
                >
                  <Image
                    source={imageSource(news.image)}
                    style={styles.mediaImage}
                    resizeMode="cover"
                  />
                  <View style={styles.mediaBody}>
                    <Text style={styles.mediaCategory}>{news.category}</Text>
                    <Text style={styles.mediaTitle}>{news.title}</Text>
                    <Text style={styles.mediaMeta}>
                      {news.date} • {news.read} • {news.views} views
                    </Text>
                    <Text style={styles.mediaExcerpt} numberOfLines={4}>
                      {news.excerpt}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {activeSection === 'Blog' && (
            <View style={styles.sectionCard}>
              <Text style={[styles.sectionTitle, { fontSize: sectionTitleSize }]}>Blog Articles</Text>
              {blogPosts.map((post) => (
                <TouchableOpacity
                  key={post.link}
                  activeOpacity={0.9}
                  onPress={() => openExternal(post.link)}
                  style={styles.mediaCard}
                >
                  <Image
                    source={imageSource(post.image)}
                    style={styles.mediaImage}
                    resizeMode="cover"
                  />
                  <View style={styles.mediaBody}>
                    <Text style={styles.mediaCategory}>{post.category}</Text>
                    <Text style={styles.mediaTitle}>{post.title}</Text>
                    <Text style={styles.mediaMeta}>
                      {post.date} • {post.read} • {post.views} views
                    </Text>
                    <Text style={styles.mediaExcerpt} numberOfLines={4}>
                      {post.excerpt}
                    </Text>
                    <Text style={styles.mediaMeta}>By {post.author}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {activeSection === 'Team' && (
            <View style={styles.sectionCard}>
              <Text style={[styles.sectionTitle, { fontSize: sectionTitleSize }]}>Team Directory</Text>
              {glowData.team.map((member) => (
                <TouchableOpacity
                  key={member.link}
                  style={styles.listCard}
                  activeOpacity={0.9}
                  onPress={() => openExternal(member.link)}
                >
                  <Image
                    source={profileImageSource(member)}
                    style={styles.thumbImage}
                    resizeMode="cover"
                  />
                  <View style={styles.listBody}>
                    <Text style={styles.mediaTitle}>{member.name}</Text>
                    <Text style={styles.mediaCategory}>{member.role} • {member.department}</Text>
                    {member.bio ? (
                      <Text style={styles.mediaExcerpt} numberOfLines={3}>
                        {member.bio}
                      </Text>
                    ) : null}
                    {member.email ? <Text style={styles.mediaMeta}>{member.email}</Text> : null}
                    {member.phone ? <Text style={styles.mediaMeta}>{member.phone}</Text> : null}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {activeSection === 'OAPs' && (
            <View style={styles.sectionCard}>
              <Text style={[styles.sectionTitle, { fontSize: sectionTitleSize }]}>On-Air Personalities</Text>
              {glowData.oaps.map((oap) => (
                <TouchableOpacity
                  key={oap.link}
                  style={styles.listCard}
                  activeOpacity={0.9}
                  onPress={() => openExternal(oap.link)}
                >
                  <Image
                    source={profileImageSource(oap)}
                    style={styles.thumbImage}
                    resizeMode="cover"
                  />
                  <View style={styles.listBody}>
                    <Text style={styles.mediaTitle}>{oap.name}</Text>
                    <Text style={styles.mediaCategory}>
                      {oap.department} • {oap.employment}
                    </Text>
                    <Text style={styles.mediaMeta}>{oap.shows}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {activeSection === 'Contact' && (
            <View>
              <View style={styles.sectionCard}>
                <Text style={[styles.sectionTitle, { fontSize: sectionTitleSize }]}>Get In Touch</Text>
                <View style={styles.contactRow}>
                  <Text style={styles.mediaTitle}>Phone</Text>
                  <Text style={styles.mediaMeta}>{glowData.contact.phone}</Text>
                </View>
                <View style={styles.contactRow}>
                  <Text style={styles.mediaTitle}>Email</Text>
                  <Text style={styles.mediaMeta}>{glowData.contact.email}</Text>
                </View>
                <View style={styles.contactRow}>
                  <Text style={styles.mediaTitle}>Address</Text>
                  <Text style={styles.mediaMeta}>{glowData.contact.address}</Text>
                </View>
              </View>
              <View style={styles.sectionCard}>
                <Text style={[styles.sectionTitle, { fontSize: sectionTitleSize }]}>Office Hours</Text>
                {Object.entries(glowData.contact.office_hours).map(([day, hours]) => (
                  <View key={day} style={styles.contactRow}>
                    <Text style={styles.mediaTitle}>{day}</Text>
                    <Text style={styles.mediaMeta}>{hours}</Text>
                  </View>
                ))}
                <Text style={styles.sectionCopy}>{glowData.contact.note}</Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function App(): JSX.Element {
  return (
    <SafeAreaProvider>
      <AppErrorBoundary>
        <AppShell />
      </AppErrorBoundary>
    </SafeAreaProvider>
  );
}

const errorStyles = StyleSheet.create({
  errorShell: {
    flex: 1,
    backgroundColor: THEME.colors.background,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  errorTitle: {
    color: '#ffb07a',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  errorBody: {
    color: THEME.colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});

const createStyles = (theme: typeof THEME) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  errorShell: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  errorTitle: {
    color: '#ffb07a',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  errorBody: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  atlanticBackdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    height: 360,
    overflow: 'hidden',
  },
  atlanticGradient: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  depthOrb: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    top: -120,
    right: -60,
    backgroundColor: 'rgba(255, 147, 70, 0.26)',
    shadowColor: 'rgba(255, 147, 70, 0.52)',
    shadowOpacity: 0.6,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 30,
  },
  depthOrbSecondary: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    bottom: -80,
    left: -40,
    backgroundColor: 'rgba(169, 83, 255, 0.2)',
    shadowColor: 'rgba(169, 83, 255, 0.45)',
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 24,
  },
  depthHorizon: {
    position: 'absolute',
    left: 20,
    right: 20,
    top: 220,
    height: 1,
    backgroundColor: 'rgba(255, 180, 130, 0.14)',
  },
  radioSweep: {
    position: 'absolute',
    left: '12%',
    height: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 199, 132, 0.82)',
    shadowColor: 'rgba(255, 199, 132, 0.54)',
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    opacity: 0.6,
  },
  radioSweepAlt: {
    height: 3,
    opacity: 0.7,
  },
  waveRing: {
    position: 'absolute',
    borderRadius: 200,
    borderColor: 'rgba(255, 199, 132, 0.68)',
    borderLeftColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  waveRingOne: {
    width: 170,
    height: 170,
    borderWidth: 10,
    top: -20,
    right: -10,
  },
  waveRingTwo: {
    width: 230,
    height: 230,
    borderWidth: 8,
    top: -60,
    right: -40,
    borderColor: 'rgba(201, 112, 255, 0.52)',
    borderLeftColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  waveRingThree: {
    width: 300,
    height: 300,
    borderWidth: 6,
    top: -100,
    right: -80,
    borderColor: 'rgba(255, 148, 84, 0.46)',
    borderLeftColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  scrollContent: {
    paddingBottom: 60,
  },
  content: {
    paddingHorizontal: 20,
    width: '100%',
    maxWidth: 860,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modeSwitch: {
    marginLeft: 12,
    padding: 4,
  },
  modeSwitchTrack: {
    width: 30,
    height: 18,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  modeSwitchTrackActive: {
    backgroundColor: 'rgba(247, 132, 54, 0.32)',
    borderColor: theme.colors.accent,
  },
  modeSwitchDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: theme.colors.highlight,
    alignSelf: 'flex-start',
  },
  modeSwitchDotActive: {
    backgroundColor: theme.colors.accent,
    alignSelf: 'flex-end',
  },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  themeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
    flexWrap: 'wrap',
  },
  themeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.glass,
  },
  themeChipActive: {
    borderColor: theme.colors.accent,
    backgroundColor: 'rgba(255, 150, 74, 0.2)',
  },
  themeChipText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontFamily: theme.fonts.body,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  themeChipTextActive: {
    color: theme.colors.textPrimary,
  },
  syncDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 198, 138, 0.52)',
  },
  syncDotActive: {
    backgroundColor: theme.colors.accent,
    shadowColor: theme.colors.accent,
    shadowOpacity: 0.9,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 6,
  },
  syncText: {
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: theme.colors.textMuted,
    fontFamily: theme.fonts.body,
  },
  logoMark: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    shadowColor: 'rgba(169, 83, 255, 0.55)',
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
  },
  logoMarkImage: {
    width: 56,
    height: 56,
  },
  logoText: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.background,
    letterSpacing: 1,
    fontFamily: theme.fonts.display,
  },
  headerCopy: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    letterSpacing: 0.4,
    fontFamily: theme.fonts.display,
  },
  titleWide: {
    fontSize: 28,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 4,
    fontFamily: theme.fonts.body,
  },
  tabRow: {
    paddingVertical: 8,
    gap: 10,
  },
  tabChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: theme.colors.glass,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  tabChipActive: {
    backgroundColor: 'rgba(245, 129, 49, 0.94)',
    borderColor: 'rgba(245, 129, 49, 0.94)',
  },
  tabText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: '600',
    fontFamily: theme.fonts.body,
  },
  tabTextActive: {
    color: theme.colors.background,
    fontWeight: '700',
    fontFamily: theme.fonts.body,
  },
  heroCard: {
    backgroundColor: theme.colors.glassStrong,
    borderRadius: theme.radius.large,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    marginBottom: 18,
    shadowColor: 'rgba(52, 18, 74, 0.58)',
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 20,
  },
  heroLogoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  heroLogo: {
    width: 72,
    height: 72,
  },
  heroLogoText: {
    color: theme.colors.textPrimary,
    fontFamily: theme.fonts.display,
    fontSize: 18,
    fontWeight: '800',
  },
  heroLogoSub: {
    color: theme.colors.textMuted,
    fontFamily: theme.fonts.body,
    fontSize: 12,
    letterSpacing: 0.6,
    marginTop: 2,
  },
  heroBadge: {
    color: theme.colors.accent,
    fontSize: 12,
    letterSpacing: 1.8,
    marginBottom: 8,
    textTransform: 'uppercase',
    fontWeight: '700',
    fontFamily: theme.fonts.body,
  },
  heroTitle: {
    color: theme.colors.textPrimary,
    fontSize: 30,
    fontWeight: '800',
    marginBottom: 6,
    letterSpacing: 0.4,
    fontFamily: theme.fonts.display,
  },
  heroHighlight: {
    color: theme.colors.glow,
  },
  heroCopy: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: theme.fonts.body,
  },
  heroActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 16,
  },
  primaryButton: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: theme.colors.accentDeep,
    shadowColor: theme.colors.accentDeep,
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
  },
  primaryButtonText: {
    color: theme.colors.background,
    fontWeight: '700',
    fontFamily: theme.fonts.body,
  },
  secondaryButton: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.glass,
  },
  secondaryButtonText: {
    color: theme.colors.textPrimary,
    fontWeight: '600',
    fontFamily: theme.fonts.body,
  },
  nowPlayingCard: {
    marginBottom: 18,
    padding: 18,
    borderRadius: theme.radius.large,
    backgroundColor: theme.colors.glass,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    shadowColor: 'rgba(4, 12, 32, 0.8)',
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 20,
  },
  cardLabel: {
    color: theme.colors.textMuted,
    fontSize: 12,
    letterSpacing: 1.3,
    marginBottom: 8,
    textTransform: 'uppercase',
    fontFamily: theme.fonts.body,
  },
  stationName: {
    color: theme.colors.textPrimary,
    fontSize: 24,
    fontWeight: '800',
    fontFamily: theme.fonts.display,
  },
  stationVibe: {
    color: theme.colors.glow,
    fontSize: 16,
    marginTop: 4,
    fontFamily: theme.fonts.body,
  },
  stationDescription: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    marginTop: 8,
    lineHeight: 20,
    fontFamily: theme.fonts.body,
  },
  controls: {
    alignItems: 'center',
    marginBottom: 24,
  },
  playButton: {
    width: 120,
    height: 120,
    borderRadius: 70,
    backgroundColor: 'rgba(38, 14, 52, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 173, 106, 0.6)',
    shadowColor: theme.colors.glow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.42,
    shadowRadius: 16,
  },
  playButtonActive: {
    backgroundColor: 'rgba(69, 26, 86, 0.92)',
    shadowColor: theme.colors.highlight,
    shadowOpacity: 0.62,
    shadowRadius: 24,
    borderColor: 'rgba(255, 201, 140, 0.95)',
  },
  playButtonGlow: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 201, 140, 0.76)',
    backgroundColor: 'rgba(255, 140, 64, 0.18)',
  },
  playBeam: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 196, 135, 0.78)',
    backgroundColor: 'transparent',
  },
  playBeamMid: {
    borderColor: 'rgba(210, 123, 255, 0.66)',
  },
  playBeamOuter: {
    borderColor: 'rgba(255, 153, 84, 0.56)',
  },
  playButtonCore: {
    width: '78%',
    height: '78%',
    borderRadius: 999,
    backgroundColor: 'rgba(29, 10, 42, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255, 190, 126, 0.34)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIconOffset: {
    marginLeft: 2,
  },
  controlHint: {
    marginTop: 12,
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontFamily: theme.fonts.body,
  },
  controlError: {
    marginTop: 8,
    color: '#ff9aa9',
    fontSize: 12,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 16,
    fontFamily: theme.fonts.body,
  },
  sectionCard: {
    backgroundColor: theme.colors.glass,
    borderRadius: theme.radius.large,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 18,
    shadowColor: 'rgba(4, 12, 32, 0.65)',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 18,
  },
  sectionTitle: {
    color: theme.colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 10,
    letterSpacing: 0.3,
    fontFamily: theme.fonts.display,
  },
  sectionCopy: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
    fontFamily: theme.fonts.body,
  },
  statScroll: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 6,
  },
  statItem: {
    minWidth: 180,
    padding: 12,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.glassStrong,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  statItemWide: {
    minWidth: 200,
  },
  statNumber: {
    color: theme.colors.glow,
    fontSize: 18,
    fontWeight: '800',
    fontFamily: theme.fonts.display,
  },
  statLabel: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    marginTop: 4,
    fontFamily: theme.fonts.body,
  },
  trendingList: {
    gap: 12,
  },
  trendingItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  trendingTitle: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    fontFamily: theme.fonts.display,
  },
  trendingMeta: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginTop: 4,
    fontFamily: theme.fonts.body,
  },
  cardGrid: {
    gap: 16,
  },
  cardGridWide: {
    gap: 16,
  },
  cardRow: {
    gap: 16,
  },
  mediaCard: {
    backgroundColor: theme.colors.glassStrong,
    borderRadius: theme.radius.medium,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 16,
    shadowColor: 'rgba(4, 12, 32, 0.5)',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 14,
  },
  mediaCardWide: {
    width: '48%',
  },
  mediaImage: {
    width: '100%',
    height: 180,
  },
  mediaBody: {
    padding: 14,
  },
  mediaCategory: {
    color: theme.colors.glow,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 6,
    fontFamily: theme.fonts.body,
  },
  mediaTitle: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
    fontFamily: theme.fonts.display,
  },
  mediaMeta: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginBottom: 6,
    fontFamily: theme.fonts.body,
  },
  mediaExcerpt: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: theme.fonts.body,
  },
  featureCard: {
    flexDirection: 'row',
    backgroundColor: theme.colors.glassStrong,
    borderRadius: theme.radius.medium,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 12,
  },
  featureImage: {
    width: 120,
    height: 120,
  },
  featureBody: {
    flex: 1,
    padding: 12,
  },
  featureTitle: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
    fontFamily: theme.fonts.display,
  },
  featureMeta: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginBottom: 4,
    fontFamily: theme.fonts.body,
  },
  listCard: {
    flexDirection: 'row',
    backgroundColor: theme.colors.glassStrong,
    borderRadius: theme.radius.medium,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 12,
    overflow: 'hidden',
  },
  listCardExpanded: {
    borderColor: theme.colors.accent,
    shadowColor: theme.colors.accent,
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  thumbImage: {
    width: 100,
    height: 100,
  },
  listBody: {
    flex: 1,
    padding: 12,
  },
  embedCard: {
    marginTop: 10,
    borderRadius: theme.radius.medium,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.glass,
    height: 220,
  },
  embedWebView: {
    flex: 1,
  },
  badgeRow: {
    paddingTop: 8,
    rowGap: 8,
  },
  badgeRowColumn: {
    gap: 8,
  },
  badgeChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.small,
    backgroundColor: theme.colors.glass,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  badgeText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: theme.fonts.body,
  },
  valueCard: {
    padding: 14,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.glassStrong,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 10,
  },
  valueTitle: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
    fontFamily: theme.fonts.display,
  },
  valueCopy: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: theme.fonts.body,
  },
  milestoneItem: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  milestoneYear: {
    color: theme.colors.glow,
    fontSize: 16,
    fontWeight: '700',
    width: 60,
    fontFamily: theme.fonts.display,
  },
  milestoneBody: {
    flex: 1,
  },
  milestoneTitle: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
    fontFamily: theme.fonts.display,
  },
  listRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  scheduleList: {
    marginTop: 12,
    gap: 10,
  },
  scheduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.glassStrong,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  scheduleCopy: {
    flex: 1,
    marginRight: 12,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: theme.colors.accent,
  },
  statusText: {
    color: theme.colors.background,
    fontSize: 11,
    fontWeight: '700',
    fontFamily: theme.fonts.body,
  },
  contactRow: {
    marginBottom: 10,
  },
});

export default App;





