
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
import { Audio, AVPlaybackStatus } from 'expo-av';
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

const RADIO_STATIONS: Station[] = [
  {
    id: 'glow-991',
    name: 'GLOW 99.1 FM',
    url: 'https://stream-176.zeno.fm/mwam2yirv1pvv',
    vibe: 'Live broadcast',
    description: 'Your Station, Your Voice â€” Akure, 24/7.',
    tags: ['99.1 FM', 'Akure', 'Live'],
  },
];

const STREAM_FALLBACK_URLS = [
  'https://stream.zeno.fm/mwam2yirv1pvv',
  'https://stream-176.zeno.fm/mwam2yirv1pvv',
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
    background: '#010915',
    surface: 'rgba(8, 22, 46, 0.68)',
    surfaceSoft: 'rgba(12, 30, 58, 0.54)',
    border: 'rgba(122, 168, 255, 0.24)',
    textPrimary: '#f5f8ff',
    textSecondary: '#c1d5f2',
    textMuted: '#8aa2c6',
    accent: '#69d6ff',
    accentDeep: '#2b7cff',
    glow: '#a6f2ff',
    highlight: '#e2fbff',
    glass: 'rgba(6, 18, 36, 0.55)',
    glassStrong: 'rgba(12, 32, 62, 0.76)',
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

const BACKDROP_THEMES = {
  atlantic: {
    label: 'Atlantic Sink',
    gradient: ['#010b16', '#042c4c', '#04162d'],
    orbPrimary: 'rgba(86, 196, 255, 0.24)',
    orbSecondary: 'rgba(0, 188, 206, 0.2)',
    ringStrong: 'rgba(105, 214, 255, 0.55)',
    ringMid: 'rgba(72, 182, 255, 0.48)',
    ringSoft: 'rgba(28, 118, 210, 0.34)',
    pulse: 'rgba(166, 242, 255, 0.78)',
  },
  aurora: {
    label: 'Neon Drift',
    gradient: ['#05051a', '#0a1d33', '#07162a'],
    orbPrimary: 'rgba(147, 112, 255, 0.24)',
    orbSecondary: 'rgba(0, 210, 190, 0.18)',
    ringStrong: 'rgba(126, 224, 255, 0.52)',
    ringMid: 'rgba(104, 184, 255, 0.44)',
    ringSoft: 'rgba(255, 156, 255, 0.26)',
    pulse: 'rgba(126, 224, 255, 0.85)',
  },
} as const;

const resolveUrl = (url: string) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `https://glowfmradio.com${url}`;
};

const imageSource = (path?: string) => {
  const resolved = resolveUrl(path ?? '');
  return resolved ? { uri: resolved } : LOGO;
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

const getStationStreamUrls = (primaryUrl: string) => {
  const urls = [primaryUrl, ...STREAM_FALLBACK_URLS].filter(Boolean);
  return [...new Set(urls)];
};

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
      <SafeAreaView style={styles.errorShell}>
        <Text style={styles.errorTitle}>App failed to render</Text>
        <Text style={styles.errorBody}>{this.state.message}</Text>
      </SafeAreaView>
    );
  }
}

const AppShell = (): JSX.Element => {
  const { data: glowData, isSyncing } = useGlowData();
  const insets = useSafeAreaInsets();
  const rawInsetTop = Number.isFinite(insets.top) ? insets.top : 0;
  const safeInsetTop = Math.max(0, Math.min(48, rawInsetTop));
  const { width } = useWindowDimensions();
  const isWide = width >= 760;
  const isCompact = width <= 360;
  const heroTitleSize = isCompact ? 26 : isWide ? 34 : 30;
  const sectionTitleSize = isCompact ? 18 : isWide ? 22 : 20;
  const playButtonSize = isCompact ? 96 : isWide ? 140 : 120;
  const [backdropTheme, setBackdropTheme] = useState<keyof typeof BACKDROP_THEMES>('atlantic');

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
  const soundRef = useRef<Audio.Sound | null>(null);
  const playPress = useRef(new Animated.Value(1)).current;
  const [expandedEpisodeId, setExpandedEpisodeId] = useState<string | null>(null);
  const playPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    LogBox.ignoreLogs(['[expo-av]: Expo AV has been deprecated']);
  }, []);

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
  
  const playPressStyle = useMemo(
    () => ({
      transform: [{ scale: playPress.interpolate({ inputRange: [0.94, 1], outputRange: [0.94, 1] }) }],
    }),
    [playPress],
  );

  const playPulseScale = playPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] });
  const playPulseOpacity = playPulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0] });

  const openExternal = useCallback((url?: string) => {
    if (!url) return;
    const resolved = resolveUrl(url);
    Linking.openURL(resolved).catch((err) => console.warn('External link failed:', err));
  }, []);

  const buildNewsUrl = (entry: any) =>
    entry?.link ||
    (entry?.slug ? `https://glowfmradio.com/news/${entry.slug}` : '');

  const scheduleDays = useMemo(() => Object.keys(glowData.schedule), [glowData.schedule]);
  const wallpaper = BACKDROP_THEMES[backdropTheme];
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
      setIsPlaying(false);
      setIsLoading(false);
      return;
    }
    setPlaybackError('');
    setIsPlaying(status.isPlaying);
    setIsLoading(status.isBuffering);
  }, []);

  useEffect(() => {
    const configureAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
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
    };
  }, []);

  useEffect(() => {
    const makeWave = (anim: Animated.Value, duration: number, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration,
            easing: easeInOutSin,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration,
            easing: easeInOutSin,
            useNativeDriver: true,
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
          useNativeDriver: true,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: 12000,
          easing: easeInOutQuad,
          useNativeDriver: true,
        }),
      ]),
    );

    driftAnimation.start();

    return () => {
      waveAnimations.forEach((animation) => animation.stop());
      driftAnimation.stop();
    };
  }, [drift, waveOne, waveTwo, waveThree]);

  useEffect(() => {
    const makeSweep = (anim: Animated.Value, delay: number, duration: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration,
            easing: linearEase,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      );

    const sweepAnimations = [makeSweep(sweepForward, 600, 5200), makeSweep(sweepReverse, 1800, 6200)];
    sweepAnimations.forEach((animation) => animation.start());

    return () => {
      sweepAnimations.forEach((animation) => animation.stop());
    };
  }, [sweepForward, sweepReverse]);

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
            useNativeDriver: true,
          }),
          Animated.timing(playPulse, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
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
  }, [isLoading, isPlaying, linearEase, playPulse]);

  const playStation = useCallback(
    async (station: Station) => {
      if (actionLock.current) return;
      actionLock.current = true;
      try {
        setIsLoading(true);
        setPlaybackError('');

        if (station.id === selectedStation.id && soundRef.current) {
          try {
            const status = await soundRef.current.getStatusAsync();
            if (status.isLoaded && !status.isPlaying) {
              await soundRef.current.playAsync();
            }
            setIsLoading(false);
            return;
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
        const candidateUrls = getStationStreamUrls(station.url);
        for (const streamUrl of candidateUrls) {
          try {
            const { sound, status } = await Audio.Sound.createAsync(
              { uri: streamUrl },
              { shouldPlay: true },
              handleStatusUpdate,
            );
            soundRef.current = sound;

            if (status.isLoaded) {
              setIsPlaying(status.isPlaying);
              setIsLoading(status.isBuffering);
              setPlaybackError('');
            } else {
              setIsLoading(false);
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
        setIsLoading(false);
        setIsPlaying(false);
      } finally {
        actionLock.current = false;
      }
    },
    [handleStatusUpdate, selectedStation.id],
  );

  const togglePlayback = useCallback(async () => {
    if (actionLock.current) {
      return;
    }

    actionLock.current = true;
    try {
      if (!soundRef.current) {
        await playStation(selectedStation);
        return;
      }

      const status = await soundRef.current.getStatusAsync();
      if (!status.isLoaded) {
        await playStation(selectedStation);
        return;
      }

      if (status.isPlaying) {
        await soundRef.current.pauseAsync();
        setIsLoading(false);
        setIsPlaying(false);
      } else {
        setIsLoading(true);
        await soundRef.current.playAsync();
      }
    } catch (error) {
      console.error('Error toggling playback:', error);
      setPlaybackError(formatPlaybackError(error));
      setIsLoading(false);
      setIsPlaying(false);
    } finally {
      actionLock.current = false;
    }
  }, [isLoading, playStation, selectedStation]);

  const handleLivePress = useCallback(async () => {
    await togglePlayback();
  }, [togglePlayback]);

  const handlePressIn = useCallback(() => {
    Animated.spring(playPress, {
      toValue: 0.94,
      useNativeDriver: true,
      speed: 20,
      bounciness: 6,
    }).start();
  }, [playPress]);

  const handlePressOut = useCallback(() => {
    Animated.spring(playPress, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 6,
    }).start();
  }, [playPress]);

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
      <StatusBar barStyle="light-content" backgroundColor={THEME.colors.background} />

      <View
        pointerEvents="none"
        style={[styles.atlanticBackdrop, { height: 360 + safeInsetTop, top: -safeInsetTop }]}
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
            <View style={styles.logoMark}>
              <Image source={LOGO} style={styles.logoMarkImage} resizeMode="contain" />
            </View>
            <View style={styles.headerCopy}>
              <Text style={[styles.title, isWide && styles.titleWide]}>Glow 99.1 FM</Text>
              <Text style={styles.subtitle}>City heartbeat, live.</Text>
            </View>
          </View>
          <View style={styles.syncRow}>
            <View style={[styles.syncDot, isSyncing && styles.syncDotActive]} />
            <Text style={styles.syncText}>{isSyncing ? 'Syncing live' : 'Live sync ready'}</Text>
          </View>
          <View style={styles.themeRow}>
            {Object.entries(BACKDROP_THEMES).map(([key, entry]) => {
              const active = backdropTheme === key;
              return (
                <TouchableOpacity
                  key={key}
                  onPress={() => setBackdropTheme(key as keyof typeof BACKDROP_THEMES)}
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
                    disabled={isLoading}
                    accessibilityRole="button"
                    accessibilityLabel="Listen live now"
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
                    playPressStyle,
                  ]}
                  onPress={handleLivePress}
                  onPressIn={handlePressIn}
                  onPressOut={handlePressOut}
                  disabled={isLoading}
                  activeOpacity={0.88}
                  hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
                  accessibilityRole="button"
                  accessibilityLabel={isPlaying ? 'Pause playback' : 'Start playback'}
                  accessibilityHint="Double tap to toggle the live stream"
                  accessibilityState={{ busy: isLoading }}
                >
                  {isLoading ? (
                    <ActivityIndicator size="large" color={THEME.colors.highlight} />
                  ) : (
                    <View style={styles.minPlayShell}>
                      {isPlaying && (
                        <Animated.View
                          pointerEvents="none"
                          style={[
                            styles.minPlayPulse,
                            { opacity: playPulseOpacity, transform: [{ scale: playPulseScale }] },
                          ]}
                        />
                      )}
                      <View style={[styles.waveIcon, isPlaying && styles.waveIconActive]}>
                        <Ionicons
                          name={isPlaying ? 'pause' : 'play'}
                          size={28}
                          color={THEME.colors.accentDeep}
                          style={!isPlaying ? styles.vinylPlayOffset : undefined}
                        />
                      </View>
                    </View>
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
                    <View style={styles.featureCard}>
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
                    </View>
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
                    <View style={styles.listCard}>
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
                    </View>
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
                    <View style={styles.listCard}>
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
                    </View>
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
                <View key={post.link} style={styles.mediaCard}>
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
                </View>
              ))}
            </View>
          )}

          {activeSection === 'Team' && (
            <View style={styles.sectionCard}>
              <Text style={[styles.sectionTitle, { fontSize: sectionTitleSize }]}>Team Directory</Text>
              {glowData.team.map((member) => (
                <View key={member.link} style={styles.listRow}>
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
                </View>
              ))}
            </View>
          )}

          {activeSection === 'OAPs' && (
            <View style={styles.sectionCard}>
              <Text style={[styles.sectionTitle, { fontSize: sectionTitleSize }]}>On-Air Personalities</Text>
              {glowData.oaps.map((oap) => (
                <View key={oap.link} style={styles.listRow}>
                  <View style={styles.listBody}>
                    <Text style={styles.mediaTitle}>{oap.name}</Text>
                    <Text style={styles.mediaCategory}>
                      {oap.department} • {oap.employment}
                    </Text>
                    <Text style={styles.mediaMeta}>{oap.shows}</Text>
                  </View>
                </View>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  errorShell: {
    flex: 1,
    backgroundColor: THEME.colors.background,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  errorTitle: {
    color: '#ffb6c1',
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
    backgroundColor: 'rgba(105, 214, 255, 0.25)',
    shadowColor: 'rgba(105, 214, 255, 0.5)',
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
    backgroundColor: 'rgba(43, 124, 255, 0.18)',
    shadowColor: 'rgba(43, 124, 255, 0.4)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  radioSweep: {
    position: 'absolute',
    left: '12%',
    height: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(166, 242, 255, 0.78)',
    shadowColor: 'rgba(166, 242, 255, 0.5)',
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
    borderColor: 'rgba(166, 242, 255, 0.65)',
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
    borderColor: 'rgba(105, 214, 255, 0.5)',
    borderLeftColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  waveRingThree: {
    width: 300,
    height: 300,
    borderWidth: 6,
    top: -100,
    right: -80,
    borderColor: 'rgba(43, 124, 255, 0.45)',
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
    marginBottom: 6,
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
    borderColor: THEME.colors.border,
    backgroundColor: THEME.colors.glass,
  },
  themeChipActive: {
    borderColor: THEME.colors.accent,
    backgroundColor: 'rgba(105, 214, 255, 0.16)',
  },
  themeChipText: {
    color: THEME.colors.textSecondary,
    fontSize: 12,
    fontFamily: THEME.fonts.body,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  themeChipTextActive: {
    color: THEME.colors.textPrimary,
  },
  syncDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(166, 242, 255, 0.5)',
  },
  syncDotActive: {
    backgroundColor: THEME.colors.accent,
    shadowColor: THEME.colors.accent,
    shadowOpacity: 0.9,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 6,
  },
  syncText: {
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: THEME.colors.textMuted,
    fontFamily: THEME.fonts.body,
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
    shadowColor: 'rgba(105, 214, 255, 0.7)',
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
    color: THEME.colors.background,
    letterSpacing: 1,
    fontFamily: THEME.fonts.display,
  },
  headerCopy: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    letterSpacing: 0.4,
    fontFamily: THEME.fonts.display,
  },
  titleWide: {
    fontSize: 28,
  },
  subtitle: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    marginTop: 4,
    fontFamily: THEME.fonts.body,
  },
  tabRow: {
    paddingVertical: 8,
    gap: 10,
  },
  tabChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: THEME.colors.glass,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  tabChipActive: {
    backgroundColor: 'rgba(105, 214, 255, 0.9)',
    borderColor: 'rgba(105, 214, 255, 0.9)',
  },
  tabText: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    fontWeight: '600',
    fontFamily: THEME.fonts.body,
  },
  tabTextActive: {
    color: THEME.colors.background,
    fontWeight: '700',
    fontFamily: THEME.fonts.body,
  },
  heroCard: {
    backgroundColor: THEME.colors.glassStrong,
    borderRadius: THEME.radius.large,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    marginBottom: 18,
    shadowColor: 'rgba(5, 20, 48, 0.6)',
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
    color: THEME.colors.textPrimary,
    fontFamily: THEME.fonts.display,
    fontSize: 18,
    fontWeight: '800',
  },
  heroLogoSub: {
    color: THEME.colors.textMuted,
    fontFamily: THEME.fonts.body,
    fontSize: 12,
    letterSpacing: 0.6,
    marginTop: 2,
  },
  heroBadge: {
    color: THEME.colors.accent,
    fontSize: 12,
    letterSpacing: 1.8,
    marginBottom: 8,
    textTransform: 'uppercase',
    fontWeight: '700',
    fontFamily: THEME.fonts.body,
  },
  heroTitle: {
    color: THEME.colors.textPrimary,
    fontSize: 30,
    fontWeight: '800',
    marginBottom: 6,
    letterSpacing: 0.4,
    fontFamily: THEME.fonts.display,
  },
  heroHighlight: {
    color: THEME.colors.glow,
  },
  heroCopy: {
    color: THEME.colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: THEME.fonts.body,
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
    backgroundColor: THEME.colors.accentDeep,
    shadowColor: THEME.colors.accentDeep,
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
  },
  primaryButtonText: {
    color: THEME.colors.background,
    fontWeight: '700',
    fontFamily: THEME.fonts.body,
  },
  secondaryButton: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    backgroundColor: THEME.colors.glass,
  },
  secondaryButtonText: {
    color: THEME.colors.textPrimary,
    fontWeight: '600',
    fontFamily: THEME.fonts.body,
  },
  nowPlayingCard: {
    marginBottom: 18,
    padding: 18,
    borderRadius: THEME.radius.large,
    backgroundColor: THEME.colors.glass,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    shadowColor: 'rgba(4, 12, 32, 0.8)',
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 20,
  },
  cardLabel: {
    color: THEME.colors.textMuted,
    fontSize: 12,
    letterSpacing: 1.3,
    marginBottom: 8,
    textTransform: 'uppercase',
    fontFamily: THEME.fonts.body,
  },
  stationName: {
    color: THEME.colors.textPrimary,
    fontSize: 24,
    fontWeight: '800',
    fontFamily: THEME.fonts.display,
  },
  stationVibe: {
    color: THEME.colors.glow,
    fontSize: 16,
    marginTop: 4,
    fontFamily: THEME.fonts.body,
  },
  stationDescription: {
    color: THEME.colors.textSecondary,
    fontSize: 14,
    marginTop: 8,
    lineHeight: 20,
    fontFamily: THEME.fonts.body,
  },
  controls: {
    alignItems: 'center',
    marginBottom: 24,
  },
  playButton: {
    width: 120,
    height: 120,
    borderRadius: 70,
    backgroundColor: 'rgba(7, 18, 38, 0.58)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(166, 242, 255, 0.5)',
    shadowColor: THEME.colors.glow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    overflow: 'hidden',
  },
  playButtonActive: {
    backgroundColor: 'rgba(13, 34, 66, 0.65)',
    shadowColor: THEME.colors.highlight,
    borderColor: 'rgba(30, 215, 96, 0.75)',
  },
  minPlayShell: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  minPlayPulse: {
    position: 'absolute',
    width: '90%',
    height: '90%',
    borderRadius: 999,
    backgroundColor: THEME.colors.accent,
  },
  waveIcon: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: 'rgba(10, 27, 54, 0.78)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveIconActive: {
    backgroundColor: 'rgba(10, 27, 54, 0.9)',
  },
  vinylPlayOffset: {
    marginLeft: 2,
  },
  controlHint: {
    marginTop: 12,
    color: THEME.colors.textSecondary,
    fontSize: 13,
    fontFamily: THEME.fonts.body,
  },
  controlError: {
    marginTop: 8,
    color: '#ff9aa9',
    fontSize: 12,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 16,
    fontFamily: THEME.fonts.body,
  },
  sectionCard: {
    backgroundColor: THEME.colors.glass,
    borderRadius: THEME.radius.large,
    padding: 18,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: 18,
    shadowColor: 'rgba(4, 12, 32, 0.65)',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 18,
  },
  sectionTitle: {
    color: THEME.colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 10,
    letterSpacing: 0.3,
    fontFamily: THEME.fonts.display,
  },
  sectionCopy: {
    color: THEME.colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
    fontFamily: THEME.fonts.body,
  },
  statScroll: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 6,
  },
  statItem: {
    minWidth: 180,
    padding: 12,
    borderRadius: THEME.radius.medium,
    backgroundColor: THEME.colors.glassStrong,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  statItemWide: {
    minWidth: 200,
  },
  statNumber: {
    color: THEME.colors.glow,
    fontSize: 18,
    fontWeight: '800',
    fontFamily: THEME.fonts.display,
  },
  statLabel: {
    color: THEME.colors.textSecondary,
    fontSize: 13,
    marginTop: 4,
    fontFamily: THEME.fonts.body,
  },
  trendingList: {
    gap: 12,
  },
  trendingItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  trendingTitle: {
    color: THEME.colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    fontFamily: THEME.fonts.display,
  },
  trendingMeta: {
    color: THEME.colors.textMuted,
    fontSize: 12,
    marginTop: 4,
    fontFamily: THEME.fonts.body,
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
    backgroundColor: THEME.colors.glassStrong,
    borderRadius: THEME.radius.medium,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: THEME.colors.border,
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
    color: THEME.colors.glow,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 6,
    fontFamily: THEME.fonts.body,
  },
  mediaTitle: {
    color: THEME.colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
    fontFamily: THEME.fonts.display,
  },
  mediaMeta: {
    color: THEME.colors.textMuted,
    fontSize: 12,
    marginBottom: 6,
    fontFamily: THEME.fonts.body,
  },
  mediaExcerpt: {
    color: THEME.colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: THEME.fonts.body,
  },
  featureCard: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.glassStrong,
    borderRadius: THEME.radius.medium,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: THEME.colors.border,
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
    color: THEME.colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
    fontFamily: THEME.fonts.display,
  },
  featureMeta: {
    color: THEME.colors.textMuted,
    fontSize: 12,
    marginBottom: 4,
    fontFamily: THEME.fonts.body,
  },
  listCard: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.glassStrong,
    borderRadius: THEME.radius.medium,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: 12,
    overflow: 'hidden',
  },
  listCardExpanded: {
    borderColor: THEME.colors.accent,
    shadowColor: THEME.colors.accent,
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
    borderRadius: THEME.radius.medium,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: THEME.colors.border,
    backgroundColor: THEME.colors.glass,
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
    borderRadius: THEME.radius.small,
    backgroundColor: THEME.colors.glass,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  badgeText: {
    color: THEME.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: THEME.fonts.body,
  },
  valueCard: {
    padding: 14,
    borderRadius: THEME.radius.medium,
    backgroundColor: THEME.colors.glassStrong,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: 10,
  },
  valueTitle: {
    color: THEME.colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
    fontFamily: THEME.fonts.display,
  },
  valueCopy: {
    color: THEME.colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: THEME.fonts.body,
  },
  milestoneItem: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  milestoneYear: {
    color: THEME.colors.glow,
    fontSize: 16,
    fontWeight: '700',
    width: 60,
    fontFamily: THEME.fonts.display,
  },
  milestoneBody: {
    flex: 1,
  },
  milestoneTitle: {
    color: THEME.colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
    fontFamily: THEME.fonts.display,
  },
  listRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
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
    borderRadius: THEME.radius.medium,
    backgroundColor: THEME.colors.glassStrong,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  scheduleCopy: {
    flex: 1,
    marginRight: 12,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: THEME.colors.accent,
  },
  statusText: {
    color: THEME.colors.background,
    fontSize: 11,
    fontWeight: '700',
    fontFamily: THEME.fonts.body,
  },
  contactRow: {
    marginBottom: 10,
  },
});

export default App;



