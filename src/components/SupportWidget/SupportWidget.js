import React, {useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  PermissionsAndroid,
  KeyboardAvoidingView,
} from 'react-native';
import Config from 'react-native-config';
import {useConfig} from '../../context/ConfigContext';
import VoiceCallWebView from './VoiceCallWebView';

/**
 * In-app support widget for the mobile app (chat-first, voice optional).
 *
 * Chat: POST {BRAIN_URL}/chat -> safe reply from the AlphaQuark support brain.
 * Voice: the Vapi WEB SDK loaded inside an invisible WebView (./VoiceCallWebView)
 *        — it uses the OS WebView's built-in WebRTC, so there is NO native .so
 *        and therefore NO Google Play 16 KB page-size problem. (The native
 *        @vapi-ai/react-native stack was removed for that reason — see CLAUDE.md
 *        "16 KB page-size check".) Chat works regardless of voice.
 *
 * Gated by the per-advisor flag `voiceSupportUserEnabled` (supportAQ →
 * advisor_config.voice_support_user_enabled, default OFF) + `visible`
 * (authenticated). Same gate as web; carries across white-labels.
 */

const BRAIN_URL = 'https://customersupport.alphaquark.in';
// The Vapi public key + assistant id now live SERVER-SIDE on the brain (the
// token-gated /voice page injects them) — the client no longer passes them.
const ACK =
  'Thanks for reaching out! 🙏 Our team has received your message and someone will get in touch with you shortly.';

// Voice runs through the Vapi WEB SDK inside an invisible WebView
// (./VoiceCallWebView) — NO native WebRTC .so, so no Google Play 16 KB page-size
// problem. (The native @vapi-ai/react-native stack was removed for that reason;
// see CLAUDE.md "16 KB page-size check".)

async function ensureMicPermission() {
  try {
    if (Platform.OS === 'android') {
      const res = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: 'Microphone access',
          message: 'Support needs your mic to start a voice call.',
          buttonPositive: 'Allow',
        },
      );
      return res === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true; // iOS prompts on first getUserMedia via the SDK
  } catch (e) {
    return false;
  }
}

export default function SupportWidget({userEmail = '', visible = false}) {
  // useConfig() returns the config object FLAT ({...config, configLoading}) —
  // not nested under `.config`. Every other consumer does `const config =
  // useConfig()`; the nested destructure here left `config` undefined, so
  // voiceSupportUserEnabled (and subdomain below) never resolved → the widget
  // was always disabled. Read it flat.
  const config = useConfig();
  const enabled = config?.voiceSupportUserEnabled === true && visible;
  const voiceAvailable = true; // WebView-based voice — no native dependency
  // Per-advisor brand for the widget header (white-label aware).
  const brandName = config?.whiteLabelText || config?.appName || 'AlphaQuark';

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    {from: 'bot', text: 'Hi! How can I help you today? Ask me anything, or tap 📞 to talk.'},
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [callStatus, setCallStatus] = useState('idle'); // idle|connecting|live|error
  const [callActive, setCallActive] = useState(false); // mounts VoiceCallWebView
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollToEnd({animated: true});
  }, [messages, open]);

  if (!enabled) return null;

  const pushMsg = m => setMessages(prev => [...prev, m]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    pushMsg({from: 'user', text});
    setSending(true);
    try {
      // advisor key → brain routes chat to THIS advisor's data (white-label
      // account-aware). config.subdomain (resolved) or the env subdomain.
      const advisor =
        config?.subdomain ||
        Config?.REACT_APP_ADVISOR_SUBDOMAIN ||
        Config?.REACT_APP_HEADER_NAME ||
        '';
      const r = await fetch(`${BRAIN_URL}/chat`, {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({senderRef: userEmail || 'app_user', text, channel: 'in_app', advisor}),
      });
      const data = await r.json().catch(() => ({}));
      pushMsg({from: 'bot', text: data.reply || ACK});
    } catch (e) {
      pushMsg({from: 'bot', text: ACK});
    } finally {
      setSending(false);
    }
  };

  // advisor key → flows into the Vapi end-of-call-report metadata (per-advisor
  // voice billing) and scopes the brain to THIS advisor (white-label).
  const advisorSub =
    config?.subdomain ||
    Config?.REACT_APP_ADVISOR_SUBDOMAIN ||
    Config?.REACT_APP_HEADER_NAME ||
    '';

  const toggleCall = async () => {
    // End an active/connecting call: unmounting VoiceCallWebView tears it down.
    if (callActive || callStatus === 'live' || callStatus === 'connecting') {
      setCallActive(false);
      setCallStatus('idle');
      return;
    }
    const ok = await ensureMicPermission();
    if (!ok) {
      pushMsg({from: 'bot', text: 'Microphone permission is needed for a voice call. You can keep chatting here.'});
      return;
    }
    setCallStatus('connecting');
    pushMsg({from: 'bot', text: '📞 Connecting your voice call…'});
    setCallActive(true); // mounts VoiceCallWebView → starts the Vapi web call
  };

  // VoiceCallWebView → call status (connecting|live|idle|error). `info` carries
  // the end reason ('inactivity' when the cost-guard auto-dropped a silent call).
  const handleVoiceStatus = (status, info) => {
    setCallStatus(status);
    if (status === 'idle' || status === 'error') {
      setCallActive(false);
      if (status === 'error') {
        pushMsg({from: 'bot', text: "Couldn't start the call. You can keep chatting here."});
      } else if (info === 'inactivity') {
        pushMsg({from: 'bot', text: 'Voice call ended after 30s of silence. Tap 📞 to start again, or keep chatting here.'});
      }
    }
  };

  const live = callStatus === 'live';

  // ── Launcher (collapsed) ──
  const launcher = (
      <TouchableOpacity
        onPress={() => setOpen(true)}
        activeOpacity={0.85}
        style={{
          position: 'absolute',
          right: 16,
          bottom: 90,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: '#2563eb',
          alignItems: 'center',
          justifyContent: 'center',
          elevation: 6,
          shadowColor: '#000',
          shadowOpacity: 0.3,
          shadowRadius: 8,
          shadowOffset: {width: 0, height: 4},
          zIndex: 9999,
        }}>
        <Text style={{fontSize: 24}}>💬</Text>
      </TouchableOpacity>
  );

  // ── Panel (expanded) ──
  const panel = (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{
        position: 'absolute',
        right: 12,
        left: 12,
        bottom: 24,
        height: 460,
        borderRadius: 16,
        backgroundColor: '#fff',
        overflow: 'hidden',
        elevation: 10,
        shadowColor: '#000',
        shadowOpacity: 0.3,
        shadowRadius: 16,
        shadowOffset: {width: 0, height: 6},
        zIndex: 10000,
      }}>
      {/* header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 14,
          paddingVertical: 12,
          backgroundColor: '#2563eb',
        }}>
        <Text style={{color: '#fff', fontWeight: '600', fontSize: 15}}>{brandName} Support</Text>
        <View style={{flexDirection: 'row', alignItems: 'center'}}>
          {voiceAvailable && (
            <TouchableOpacity
              onPress={toggleCall}
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: live ? '#dc2626' : '#16a34a',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 10,
              }}>
              <Text style={{fontSize: 15}}>{live ? '⏹️' : '📞'}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => setOpen(false)}>
            <Text style={{color: '#fff', fontSize: 22}}>×</Text>
          </TouchableOpacity>
        </View>
      </View>

      {live && (
        <View style={{backgroundColor: '#dcfce7', paddingVertical: 6}}>
          <Text style={{color: '#166534', fontSize: 12, textAlign: 'center'}}>🎙️ Voice call live — speak now</Text>
        </View>
      )}

      {/* messages */}
      <ScrollView ref={scrollRef} style={{flex: 1, backgroundColor: '#f8fafc'}} contentContainerStyle={{padding: 12}}>
        {messages.map((m, i) => (
          <View
            key={i}
            style={{
              alignSelf: m.from === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '82%',
              marginVertical: 5,
              paddingHorizontal: 12,
              paddingVertical: 9,
              borderRadius: 12,
              backgroundColor: m.from === 'user' ? '#2563eb' : '#fff',
              borderWidth: m.from === 'user' ? 0 : 1,
              borderColor: '#e2e8f0',
            }}>
            <Text style={{color: m.from === 'user' ? '#fff' : '#0f172a', fontSize: 13.5, lineHeight: 19}}>{m.text}</Text>
          </View>
        ))}
        {sending && <ActivityIndicator style={{marginTop: 8}} color="#2563eb" />}
      </ScrollView>

      {/* input */}
      <View style={{flexDirection: 'row', alignItems: 'center', padding: 10, borderTopWidth: 1, borderTopColor: '#e2e8f0'}}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Type your question…"
          placeholderTextColor="#94a3b8"
          editable={!sending}
          onSubmitEditing={send}
          style={{
            flex: 1,
            paddingHorizontal: 14,
            paddingVertical: 9,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: '#cbd5e1',
            fontSize: 13.5,
            color: '#0f172a',
          }}
        />
        <TouchableOpacity
          onPress={send}
          disabled={sending}
          style={{
            marginLeft: 8,
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: '#2563eb',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text style={{color: '#fff', fontSize: 16}}>➤</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );

  // Single stable mount: VoiceCallWebView lives at a fixed position in the tree
  // (always the fragment's first child) so toggling launcher↔panel does NOT
  // remount it — the call survives collapse/expand. It's invisible/audio-only.
  return (
    <>
      {callActive && (
        <VoiceCallWebView
          metadata={{advisor: advisorSub, senderRef: userEmail || 'app_user'}}
          onStatus={handleVoiceStatus}
        />
      )}
      {open ? panel : launcher}
    </>
  );
}
