import { AdMob, AdMobInitializationOptions, RewardAdOptions, RewardAdPluginEvents, InterstitialAdPluginEvents, BannerAdSize, BannerAdPosition } from '@capacitor-community/admob';
import { Capacitor } from '@capacitor/core';

let isInitialized = false;

export const initializeAdMob = async () => {
  if (Capacitor.getPlatform() === 'web') return;
  if (isInitialized) return;
  
  try {
    const options: AdMobInitializationOptions = {
      initializeForTesting: false,
    };
    await AdMob.initialize(options);
    isInitialized = true;
  } catch (error) {
    console.error('AdMob initialization failed', error);
  }
};

export const showRewardedAd = async (
  onReward: () => void, 
  onError: (err: any) => void, 
  onDismiss: () => void
) => {
  if (Capacitor.getPlatform() === 'web') {
    console.log('Simulating Rewarded Ad on Web');
    setTimeout(() => {
      onReward();
      onDismiss();
    }, 3000);
    return;
  }

  try {
    await initializeAdMob();

    const options: RewardAdOptions = {
      adId: 'ca-app-pub-4288324218526190/8832383188',
      isTesting: false,
    };

    let rewardGranted = false;

    let rewardListener: any;
    let loadFailListener: any;
    let showFailListener: any;
    let dismissListener: any;

    const cleanupListeners = () => {
      if (rewardListener) rewardListener.remove();
      if (loadFailListener) loadFailListener.remove();
      if (showFailListener) showFailListener.remove();
      if (dismissListener) dismissListener.remove();
    };

    rewardListener = await AdMob.addListener(RewardAdPluginEvents.Rewarded, (rewardItem) => {
      console.log('Rewarded Ad Reward Received', rewardItem);
      rewardGranted = true;
    });

    loadFailListener = await AdMob.addListener(RewardAdPluginEvents.FailedToLoad, (error) => {
      console.error('Rewarded Ad Failed to Load', error);
      onError(error);
      cleanupListeners();
    });

    showFailListener = await AdMob.addListener(RewardAdPluginEvents.FailedToShow, (error) => {
      console.error('Rewarded Ad Failed to Show', error);
      onError(error);
      cleanupListeners();
    });

    dismissListener = await AdMob.addListener(RewardAdPluginEvents.Dismissed, () => {
      console.log('Rewarded Ad Dismissed');
      if (rewardGranted) {
        onReward();
      }
      onDismiss();
      cleanupListeners();
    });

    await AdMob.prepareRewardVideoAd(options);
    await AdMob.showRewardVideoAd();
  } catch (error) {
    console.error('Error showing rewarded ad', error);
    onError(error);
  }
};

export const showInterstitialAd = async (
  onDismiss: () => void,
  onError: (err: any) => void = () => {}
) => {
  if (Capacitor.getPlatform() === 'web') {
    console.log('Simulating Interstitial Ad on Web');
    // Simulate a brief delay for the ad
    setTimeout(() => {
      onDismiss();
    }, 1000);
    return;
  }

  try {
    await initializeAdMob();

    const options = {
      adId: 'ca-app-pub-4288324218526190/1290229653',
      isTesting: false,
    };

    let loadFailListener: any;
    let showFailListener: any;
    let dismissListener: any;

    const cleanupListeners = () => {
      if (loadFailListener) loadFailListener.remove();
      if (showFailListener) showFailListener.remove();
      if (dismissListener) dismissListener.remove();
    };

    loadFailListener = await AdMob.addListener(InterstitialAdPluginEvents.FailedToLoad, (error) => {
      console.error('Interstitial Ad Failed to Load', error);
      onError(error);
      onDismiss(); // Proceed anyway if ad fails
      cleanupListeners();
    });

    showFailListener = await AdMob.addListener(InterstitialAdPluginEvents.FailedToShow, (error) => {
      console.error('Interstitial Ad Failed to Show', error);
      onError(error);
      onDismiss(); // Proceed anyway if ad fails
      cleanupListeners();
    });

    dismissListener = await AdMob.addListener(InterstitialAdPluginEvents.Dismissed, () => {
      console.log('Interstitial Ad Dismissed');
      onDismiss();
      cleanupListeners();
    });

    await AdMob.prepareInterstitial(options);
    await AdMob.showInterstitial();
  } catch (error) {
    console.error('Error showing interstitial ad', error);
    onError(error);
    onDismiss(); // Proceed anyway
  }
};

export const showNativeAd = async () => {
  if (Capacitor.getPlatform() === 'web') {
    console.log('Simulating Native Ad on Web');
    return;
  }

  try {
    await initializeAdMob();

    // Use the specific Native Ad Unit ID provided by the user
    // Since true Native Advanced ads require native layout injection, 
    // we use a Large Banner container which AdMob can often fill with a native-style ad.
    const options = {
      adId: 'ca-app-pub-4288324218526190/6511812928', // User's Native Ad ID
      adSize: BannerAdSize.MEDIUM_RECTANGLE,
      position: BannerAdPosition.CENTER,
      margin: 0,
      isTesting: false,
    };

    await AdMob.showBanner(options);
  } catch (error) {
    console.error('Error showing Native ad', error);
  }
};

export const showAdViewBanner = async () => {
  if (Capacitor.getPlatform() === 'web') {
    console.log('Simulating Ad View Banner on Web');
    return;
  }

  try {
    await initializeAdMob();
    const options = {
      adId: 'ca-app-pub-4288324218526190/9060448049',
      adSize: BannerAdSize.BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      margin: 0,
      isTesting: false,
    };
    await AdMob.showBanner(options);
  } catch (error) {
    console.error('Error showing Ad View banner', error);
  }
};

export const hideBanner = async () => {
  if (Capacitor.getPlatform() === 'web') return;
  try {
    await AdMob.removeBanner();
  } catch (error) {
    console.error('Error hiding banner', error);
  }
};

export const showAppOpenAd = async (
  onDismiss: () => void,
  onError: (err: any) => void = () => {}
) => {
  if (Capacitor.getPlatform() === 'web') {
    console.log('Simulating App Open Ad on Web');
    setTimeout(() => {
      onDismiss();
    }, 1000);
    return;
  }

  try {
    await initializeAdMob();

    // Use the specific App Open Ad Unit ID provided by the user
    // We use the Interstitial API because @capacitor-community/admob 8.0.0 doesn't support AppOpenAd directly
    const options = {
      adId: 'ca-app-pub-4288324218526190/3828763082', // User's App Open Ad ID
      isTesting: false,
    };

    let loadFailListener: any;
    let showFailListener: any;
    let dismissListener: any;

    const cleanupListeners = () => {
      if (loadFailListener) loadFailListener.remove();
      if (showFailListener) showFailListener.remove();
      if (dismissListener) dismissListener.remove();
    };

    loadFailListener = await AdMob.addListener(InterstitialAdPluginEvents.FailedToLoad, (error) => {
      console.error('App Open (Interstitial) Ad Failed to Load', error);
      onError(error);
      onDismiss(); 
      cleanupListeners();
    });

    showFailListener = await AdMob.addListener(InterstitialAdPluginEvents.FailedToShow, (error) => {
      console.error('App Open (Interstitial) Ad Failed to Show', error);
      onError(error);
      onDismiss();
      cleanupListeners();
    });

    dismissListener = await AdMob.addListener(InterstitialAdPluginEvents.Dismissed, () => {
      console.log('App Open (Interstitial) Ad Dismissed');
      onDismiss();
      cleanupListeners();
    });

    await AdMob.prepareInterstitial(options);
    await AdMob.showInterstitial();
  } catch (error) {
    console.error('Error showing App Open (Interstitial) ad', error);
    onError(error);
    onDismiss(); 
  }
};

export const showRewardedInterstitialAd = async (
  onReward: () => void,
  onDismiss: () => void,
  onError: (err: any) => void = () => {}
) => {
  if (Capacitor.getPlatform() === 'web') {
    console.log('Simulating Rewarded Interstitial Ad on Web');
    setTimeout(() => {
      onReward();
      onDismiss();
    }, 1500);
    return;
  }

  try {
    await initializeAdMob();

    // Use the specific Rewarded Interstitial Ad Unit ID
    // We'll use the prepareRewardVideoAd as it's the standard for rewarded formats in this plugin
    const options: RewardAdOptions = {
      adId: 'ca-app-pub-4288324218526190/9504595744', 
      isTesting: false,
    };

    let rewardGranted = false;
    let rewardListener: any;
    let dismissListener: any;

    const cleanup = () => {
      if (rewardListener) rewardListener.remove();
      if (dismissListener) dismissListener.remove();
    };

    rewardListener = await AdMob.addListener(RewardAdPluginEvents.Rewarded, (reward) => {
      console.log('Rewarded Interstitial Reward Granted');
      rewardGranted = true;
    });

    dismissListener = await AdMob.addListener(RewardAdPluginEvents.Dismissed, () => {
      console.log('Rewarded Interstitial Ad Dismissed');
      if (rewardGranted) onReward();
      onDismiss();
      cleanup();
    });

    await AdMob.prepareRewardVideoAd(options);
    await AdMob.showRewardVideoAd();
  } catch (error) {
    console.error('Error showing Rewarded Interstitial ad', error);
    onError(error);
    onDismiss(); // Proceed anyway
  }
};
