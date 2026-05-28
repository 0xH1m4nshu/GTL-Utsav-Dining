import { useEffect, useMemo, useRef, useState } from 'react';
import { API_BASE } from '../config/api';
import { getUserDisplayName, useUser } from '../context/UserContext';

const STORAGE_KEY = 'gtl_assistant_session_v1';

const defaultSuggestions = [
  'Track my latest order',
  'Track order #12',
  'What are your hours?',
  'Show vegetarian dishes',
];

const supportSnapshot = {
  brand: 'GTL Utsav Dining',
  supportHours: 'Daily, 10:00 AM to 11:00 PM',
  phone: '+91-20-5555-0142',
  email: 'support@gtlutsavdining.com',
  branches: [
    {
      name: 'Pune Camp',
      address: 'MG Road, Camp, Pune, Maharashtra',
      hours: 'Mon-Sun 11:00 AM to 11:00 PM',
      location: { lat: 18.5196, lng: 73.8786 },
    },
    {
      name: 'Baner',
      address: 'Baner Road, Pune, Maharashtra',
      hours: 'Mon-Sun 10:30 AM to 11:30 PM',
      location: { lat: 18.559, lng: 73.7868 },
    },
  ],
  trackedOrders: {
    'HT-1024': {
      status: 'Out for delivery',
      eta: '25 minutes',
      routeLabel: 'Live route tracking enabled',
      mapEmbed:
        'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3783.149839261876!2d73.89253!3d18.53631!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bc2c1441f58b09b%3A0x13f67b3e9cad7c98!2sKoregaon%20Park%2C%20Pune%2C%20Maharashtra!5e0!3m2!1sen!2sin!4v1700000000000',
      mapLink:
        'https://www.google.com/maps/search/?api=1&query=18.53631,73.89253',
    },
    'HT-2048': {
      status: 'Preparing in kitchen',
      eta: '15 minutes',
      routeLabel: 'Kitchen handoff in progress',
      mapEmbed:
        'https://www.google.com/maps?q=Baner%20Road%2C%20Pune%2C%20Maharashtra&z=14&output=embed',
      mapLink:
        'https://www.google.com/maps/search/?api=1&query=Baner%20Road%2C%20Pune%2C%20Maharashtra',
    },
  },
  faqs: [
    {
      question: 'Do you have vegetarian options?',
      answer: 'Yes. Popular vegetarian dishes include Paneer Tikka, Crispy Samosas, and the GTL Grand Thali.',
    },
    {
      question: 'How do I contact support?',
      answer: 'You can contact support at +91-20-5555-0142 or support@gtlutsavdining.com during support hours.',
    },
    {
      question: 'Do you accept reservations?',
      answer: 'Yes. Reservations are available up to 14 days in advance, and larger parties need phone confirmation.',
    },
  ],
};

const buildMetaFallback = () => ({
  brand: supportSnapshot.brand,
  supportHours: supportSnapshot.supportHours,
  phone: supportSnapshot.phone,
  email: supportSnapshot.email,
  branches: supportSnapshot.branches,
});

const createMapLink = (location) =>
  location ? `https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}` : supportSnapshot.trackedOrders['HT-1024'].mapLink;

const createMapEmbed = (location) =>
  location ? `https://www.google.com/maps?q=${location.lat},${location.lng}&z=14&output=embed` : supportSnapshot.trackedOrders['HT-1024'].mapEmbed;

const buildTrackedOrderView = (trackedOrderId, liveOrder) => {
  if (liveOrder?.id && String(liveOrder.id) === String(trackedOrderId)) {
    const destination = liveOrder.delivery_location || liveOrder.restaurant_location || null;
    return {
      status: liveOrder.status || 'Tracked live',
      eta: liveOrder.eta || 'Updating',
      routeLabel: liveOrder.driver_location ? 'Live route tracking enabled' : 'Kitchen and order status synced',
      mapEmbed: createMapEmbed(destination),
      mapLink: createMapLink(destination),
    };
  }
  return supportSnapshot.trackedOrders[trackedOrderId] || supportSnapshot.trackedOrders['HT-1024'];
};

const formatBookingTime = (value) => {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }
  const match = raw.match(/^(\d{2}):(\d{2})/);
  if (!match) {
    return raw;
  }
  const date = new Date();
  date.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

const formatBookingDate = (value) => {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

const buildWelcomeMessage = (displayName) => ({
  id: 'welcome',
  role: 'assistant',
  text: displayName
    ? `Welcome in, ${displayName}. Ask about menu details, support, reservations, or enter an order ID like #12 to start live tracking.`
    : 'Welcome in. Ask about support, menu details, reservations, or enter an order ID like #12 to start live tracking.',
});

const buildMessageId = (role) => `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const formatIntentLabel = (intent) =>
  String(intent || 'support')
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const extractOrderId = (text) => {
  const value = String(text || '');
  const legacyMatch = value.match(/\bHT-\d{4}\b/i);
  if (legacyMatch) {
    return legacyMatch[0].toUpperCase();
  }
  const liveMatch = value.match(/\border\s*#?\s*(\d{1,10})\b/i) || value.match(/#(\d{1,10})\b/);
  return liveMatch ? liveMatch[1] : '';
};

const ChatAssistant = () => {
  const { user } = useUser();
  const displayName = getUserDisplayName(user);
  const [isOpen, setIsOpen] = useState(false);
  const [isInfoPanelOpen, setIsInfoPanelOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState(() => [buildWelcomeMessage(displayName)]);
  const [sessionId, setSessionId] = useState('');
  const [suggestions, setSuggestions] = useState(defaultSuggestions);
  const [cart, setCart] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [lastIntent, setLastIntent] = useState('support');
  const [trackedOrderId, setTrackedOrderId] = useState('HT-1024');
  const [assistantMeta, setAssistantMeta] = useState(() => buildMetaFallback());
  const [liveContext, setLiveContext] = useState({});
  const [latestBooking, setLatestBooking] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [faqItems, setFaqItems] = useState(supportSnapshot.faqs);
  const [copiedMessageId, setCopiedMessageId] = useState('');
  const bodyRef = useRef(null);
  const composerInputRef = useRef(null);

  useEffect(() => {
    setMessages((current) => {
      if (!current.length || current[0]?.id !== 'welcome') {
        return current;
      }
      const nextWelcome = buildWelcomeMessage(displayName);
      if (current[0].text === nextWelcome.text) {
        return current;
      }
      return [nextWelcome, ...current.slice(1)];
    });
  }, [displayName]);

  useEffect(() => {
    const savedSessionId = window.localStorage.getItem(STORAGE_KEY) || '';
    if (savedSessionId) {
      setSessionId(savedSessionId);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadAssistantMeta = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/assistant/meta`, {
          credentials: 'include',
        });
        const payload = await response.json();
        const nextMeta = payload?.data;
        if (!response.ok || !payload.success || !nextMeta || !isMounted) {
          return;
        }
        setAssistantMeta({
          brand: nextMeta.brand || supportSnapshot.brand,
          supportHours: nextMeta.supportHours || supportSnapshot.supportHours,
          phone: nextMeta.phone || supportSnapshot.phone,
          email: nextMeta.email || supportSnapshot.email,
          branches: Array.isArray(nextMeta.branches) && nextMeta.branches.length ? nextMeta.branches : supportSnapshot.branches,
        });
      } catch {
        // Keep local fallback metadata when the API is unavailable.
      }
    };

    const loadFaqs = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/assistant/faqs`, {
          credentials: 'include',
        });
        const payload = await response.json();
        const nextFaqs = payload?.data?.faqs;
        if (!response.ok || !payload.success || !Array.isArray(nextFaqs) || !isMounted) {
          return;
        }
        setFaqItems(nextFaqs);
      } catch {
        // Keep local fallback FAQs when the API is unavailable.
      }
    };

    loadAssistantMeta();
    loadFaqs();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [messages, isOpen, isInfoPanelOpen, isLoading]);

  useEffect(() => {
    if (!composerInputRef.current) {
      return;
    }
    composerInputRef.current.style.height = '0px';
    composerInputRef.current.style.height = `${Math.min(composerInputRef.current.scrollHeight, 132)}px`;
  }, [draft]);

  const canSend = useMemo(() => draft.trim().length > 0 && !isLoading, [draft, isLoading]);
  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      }).format(new Date()),
    [],
  );

  const activeOrder = useMemo(
    () => buildTrackedOrderView(trackedOrderId, liveContext?.order),
    [trackedOrderId, liveContext],
  );
  const menuQrCard = liveContext?.menu_qr || null;

  const menuPreview = useMemo(() => menuItems.slice(0, 3), [menuItems]);
  const quickModes = useMemo(
    () => [
      {
        label: 'Track Order',
        icon: 'fa-solid fa-motorcycle',
        prompt: trackedOrderId ? `Track order ${trackedOrderId}` : 'Track my latest order',
      },
      {
        label: 'Veg Picks',
        icon: 'fa-solid fa-leaf',
        prompt: 'Show vegetarian dishes',
      },
      {
        label: 'Book Table',
        icon: 'fa-solid fa-calendar-check',
        prompt: 'Book a table for 4 tomorrow at 7:30 pm',
      },
      {
        label: 'Support',
        icon: 'fa-solid fa-headset',
        prompt: 'How do I contact support?',
      },
    ],
    [trackedOrderId],
  );
  const smartStats = useMemo(
    () => [
      {
        label: 'Messages',
        value: `${messages.length}`,
      },
      {
        label: 'Intent',
        value: formatIntentLabel(lastIntent),
      },
      {
        label: 'Cart',
        value: cart?.items?.length ? `${cart.items.length} items` : 'Empty',
      },
      {
        label: 'Reservation',
        value: latestBooking ? `#${latestBooking.id}` : 'None',
      },
    ],
    [cart, lastIntent, latestBooking, messages.length],
  );

  const appendMessage = (role, text) => {
    setMessages((current) => [
      ...current,
      {
        id: buildMessageId(role),
        role,
        text,
      },
    ]);
  };

  const addMenuItemToOrder = (itemName) => {
    sendMessage(`Add 1 ${itemName}`);
  };

  const sendMessage = async (messageText) => {
    const message = messageText.trim();
    if (!message || isLoading) {
      return;
    }

    const requestedOrderId = extractOrderId(message);
    if (requestedOrderId) {
      setTrackedOrderId(requestedOrderId);
    }

    appendMessage('user', message);
    setDraft('');
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/assistant/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message,
          sessionId: sessionId || undefined,
        }),
      });

      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'The assistant is unavailable right now.');
      }

      const assistantData = payload.data || {};
      const nextSessionId = assistantData.sessionId || '';
      const replyText = assistantData.reply || 'I am here to help.';
      const responseOrderId = String(
        assistantData.backendOrderId || assistantData.liveContext?.order?.id || extractOrderId(replyText) || '',
      );

      appendMessage('assistant', replyText);
      setSuggestions(assistantData.suggestions?.length ? assistantData.suggestions : defaultSuggestions);
      setCart(assistantData.cart || null);
      setMenuItems(Array.isArray(assistantData.menuItems) ? assistantData.menuItems : []);
      setLastIntent(assistantData.intent || 'support');
      setLiveContext(assistantData.liveContext || {});
      setLatestBooking(assistantData.placedBooking || assistantData.liveContext?.bookings?.[0] || null);

      if (responseOrderId) {
        setTrackedOrderId(responseOrderId);
      }

      if (
        assistantData.intent === 'order_status' ||
        assistantData.intent === 'reservation' ||
        assistantData.intent === 'location' ||
        assistantData.intent === 'faq'
      ) {
        setIsInfoPanelOpen(true);
      }

      if (nextSessionId) {
        setSessionId(nextSessionId);
        window.localStorage.setItem(STORAGE_KEY, nextSessionId);
      }
    } catch (error) {
      appendMessage('assistant', error.message || 'The assistant is unavailable right now.');
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([buildWelcomeMessage(displayName)]);
    setDraft('');
    setSuggestions(defaultSuggestions);
    setCart(null);
    setMenuItems([]);
    setLastIntent('support');
    setTrackedOrderId('HT-1024');
    setLiveContext({});
    setLatestBooking(null);
    setSessionId('');
    window.localStorage.removeItem(STORAGE_KEY);
  };

  const handleComposerKeyDown = (event) => {
    if (event.key !== 'Enter' || event.shiftKey) {
      return;
    }
    event.preventDefault();
    sendMessage(draft);
  };

  const copyMessage = async (messageId, messageText) => {
    try {
      await navigator.clipboard.writeText(messageText);
      setCopiedMessageId(messageId);
      window.setTimeout(() => {
        setCopiedMessageId((current) => (current === messageId ? '' : current));
      }, 1600);
    } catch {
      setCopiedMessageId('');
    }
  };

  return (
    <div className={`chat-assistant ${isOpen ? 'open' : ''}`}>
      {isOpen && (
        <button
          type="button"
          className="chat-assistant-backdrop"
          aria-label="Close AI assistant"
          onClick={() => setIsOpen(false)}
        />
      )}
      {!isOpen && (
        <button
          type="button"
          className="chat-assistant-toggle"
          aria-label="Open AI assistant"
          onClick={() => setIsOpen(true)}
        >
          <span className="chat-assistant-toggle-icon">
            <i className="fa fa-comments" />
          </span>
          <span className="chat-assistant-toggle-copy">
            <strong>AI Assistance</strong>
            <span>Menu help, live support, order tracking</span>
          </span>
          <span className="chat-assistant-toggle-badge">Live</span>
        </button>
      )}

      {isOpen && (
        <section className="chat-assistant-panel" aria-label="AI assistant panel">
          <div className="chat-assistant-shell">
            <div className="chat-assistant-main">
              <div className="chat-assistant-workspace-header">
                <div className="chat-assistant-workspace-copy">
                  <strong>Live support workspace</strong>
                  <p>{assistantMeta.brand} help for orders, reservations, menu questions, and support follow-ups.</p>
                </div>
                <div className="chat-assistant-workspace-actions">
                  <span className="chat-assistant-status-pill">{sessionId ? 'Memory on' : 'Fresh chat'}</span>
                  <span className="chat-assistant-status-pill chat-assistant-status-pill-accent">
                    {activeOrder.status}
                  </span>
                  <button
                    type="button"
                    className="chat-assistant-hamburger"
                    aria-label={isInfoPanelOpen ? 'Hide support side panel' : 'Show support side panel'}
                    onClick={() => setIsInfoPanelOpen((current) => !current)}
                  >
                    <i className="fa fa-bars" />
                  </button>
                  <button
                    type="button"
                    className="chat-assistant-close"
                    aria-label="Close AI assistant"
                    onClick={() => setIsOpen(false)}
                  >
                    <i className="fa fa-times" />
                  </button>
                </div>
              </div>

              <div className="chat-assistant-mode-strip" aria-label="Quick assistant modes">
                {quickModes.map((mode) => (
                  <button
                    type="button"
                    key={mode.label}
                    className="chat-assistant-mode-card"
                    onClick={() => sendMessage(mode.prompt)}
                    disabled={isLoading}
                  >
                    <i className={mode.icon} />
                    <span>{mode.label}</span>
                  </button>
                ))}
              </div>

              <div className="chat-assistant-body" ref={bodyRef}>
                <div className="chat-assistant-day-chip">{todayLabel}</div>
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`chat-message-row ${message.role === 'user' ? 'chat-message-row-user' : 'chat-message-row-assistant'}`}
                  >
                    <span className={`chat-message-avatar ${message.role === 'user' ? 'chat-message-avatar-user' : 'chat-message-avatar-assistant'}`}>
                      {message.role === 'user' ? (displayName?.trim()?.charAt(0)?.toUpperCase() || 'Y') : 'GTL'}
                    </span>
                    <article
                      className={`chat-bubble ${message.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-assistant'}`}
                    >
                      {message.role === 'assistant' && (
                        <span className="chat-bubble-label">{assistantMeta.brand} Concierge</span>
                      )}
                      {message.role === 'user' && <span className="chat-bubble-label">You</span>}
                      {message.text}
                      {message.role === 'assistant' && (
                        <div className="chat-bubble-actions">
                          <button
                            type="button"
                            className="chat-bubble-action"
                            onClick={() => copyMessage(message.id, message.text)}
                          >
                            <i className={`fa-solid ${copiedMessageId === message.id ? 'fa-check' : 'fa-copy'}`} />
                            <span>{copiedMessageId === message.id ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>
                      )}
                    </article>
                  </div>
                ))}

                {menuPreview.length > 0 && (
                  <section className="chat-assistant-menu-preview" aria-label="Suggested menu items">
                    {menuPreview.map((item) => (
                      <article className="chat-assistant-menu-card" key={item.name}>
                        <div className="chat-assistant-menu-card-top">
                          <strong>{item.name}</strong>
                          <span>{item.price}</span>
                        </div>
                        <span className="chat-assistant-menu-card-meta">{item.category}</span>
                        <p>{item.description}</p>
                        <button
                          type="button"
                          className="chat-assistant-menu-add"
                          onClick={() => addMenuItemToOrder(item.name)}
                          disabled={isLoading}
                        >
                          {isLoading ? 'Adding...' : '+ Add'}
                        </button>
                      </article>
                    ))}
                  </section>
                )}

                {menuQrCard?.qr_image && (
                  <section className="chat-assistant-menu-preview" aria-label="Menu QR code">
                    <article className="chat-assistant-menu-card" style={{ maxWidth: '260px' }}>
                      <div className="chat-assistant-menu-card-top">
                        <strong>Scan QR for menu</strong>
                      </div>
                      <a href={menuQrCard.menu_url || '/order-online'} target="_blank" rel="noreferrer">
                        <img
                          src={menuQrCard.qr_image}
                          alt="Menu QR"
                          style={{
                            width: '100%',
                            aspectRatio: '1 / 1',
                            borderRadius: '12px',
                            border: '1px solid rgba(141, 79, 43, 0.2)',
                            marginTop: '10px',
                            background: '#fff',
                          }}
                        />
                      </a>
                      <a
                        href="/order-online?dine_in=1"
                        className="chat-assistant-cta"
                        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}
                      >
                        Open Menu
                      </a>
                    </article>
                  </section>
                )}

                {isLoading && (
                  <article className="chat-bubble chat-bubble-assistant chat-bubble-loading">
                    Thinking through your request...
                  </article>
                )}
              </div>

              <div className="chat-assistant-composer">
                <div className="chat-assistant-composer-actions">
                  <button type="button" className="chat-assistant-clear" onClick={clearChat}>
                    Clear chat
                  </button>
                </div>

                <div className="chat-assistant-form-shell">
                  <form
                    className="chat-assistant-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      sendMessage(draft);
                    }}
                  >
                    <textarea
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={handleComposerKeyDown}
                      placeholder="Try: Track order #12 or suggest a good vegetarian dinner for 2"
                      className="chat-assistant-input"
                      rows={1}
                    />
                    <button type="submit" className="chat-assistant-send" disabled={!canSend}>
                      <i className="fa-solid fa-arrow-up" />
                      <span>Send</span>
                    </button>
                  </form>
                </div>

                <div className="chat-assistant-suggestions-wrap">
                  <div className="chat-assistant-suggestions">
                    {suggestions.slice(0, 4).map((suggestion) => (
                      <button
                        type="button"
                        key={suggestion}
                        className="chat-assistant-chip"
                        onClick={() => sendMessage(suggestion)}
                        disabled={isLoading}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <aside className={`chat-assistant-sidepanel ${isInfoPanelOpen ? 'open' : ''}`}>
              <div className="chat-assistant-sidepanel-head">
                <div>
                  <span className="chat-assistant-signal-label">Live Delivery Intel</span>
                  <h4>Order Tracker</h4>
                </div>
                <button
                  type="button"
                  className="chat-assistant-sidepanel-close"
                  aria-label="Close support side panel"
                  onClick={() => setIsInfoPanelOpen(false)}
                >
                  <i className="fa fa-times" />
                </button>
              </div>

              <p className="chat-assistant-sidepanel-intro">
                Monitor tracked orders, follow live status when available, and keep checkout context visible while you chat.
              </p>

              <div className="chat-assistant-map-card">
                <iframe
                  title="Restaurant support map"
                  src={activeOrder.mapEmbed}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  allowFullScreen
                />
              </div>

              <div className="chat-assistant-sidepanel-maplink">
                <a
                  href={activeOrder.mapLink}
                  target="_blank"
                  rel="noreferrer"
                  className="chat-assistant-ghost-button"
                >
                  Open in Google Maps
                </a>
              </div>

              <div className="chat-assistant-sidepanel-section chat-assistant-route-row">
                <div>
                  <strong>Active route</strong>
                  <span>{trackedOrderId}</span>
                </div>
                <button type="button" className="chat-assistant-ghost-button" onClick={() => sendMessage(`Track order ${trackedOrderId}`)}>
                  Track latest
                </button>
              </div>

              <div className="chat-assistant-sidepanel-section">
                <strong>Live Status</strong>
                <p className="chat-assistant-sidepanel-copy">
                  {activeOrder.status} with ETA {activeOrder.eta}. {activeOrder.routeLabel}
                </p>
              </div>

              <div className="chat-assistant-sidepanel-section">
                <div>
                  <strong>Latest Reservation</strong>
                  <span>Chat-created and live reservation details.</span>
                </div>
                {latestBooking ? (
                  <div className="chat-assistant-order-list">
                    <div className="chat-assistant-order-row">
                      <span>Booking</span>
                      <span>#{latestBooking.id}</span>
                    </div>
                    <div className="chat-assistant-order-row">
                      <span>Date</span>
                      <span>{formatBookingDate(latestBooking.date)}</span>
                    </div>
                    <div className="chat-assistant-order-row">
                      <span>Time</span>
                      <span>{formatBookingTime(latestBooking.time)}</span>
                    </div>
                    <div className="chat-assistant-order-row">
                      <span>Guests</span>
                      <span>{latestBooking.guests}</span>
                    </div>
                    <div className="chat-assistant-order-row">
                      <span>Status</span>
                      <span>{latestBooking.status}</span>
                    </div>
                    <div className="chat-assistant-order-row">
                      <span>Table</span>
                      <span>{latestBooking.table_code || 'Pending assignment'}</span>
                    </div>
                  </div>
                ) : (
                  <p className="chat-assistant-sidepanel-copy">
                    No reservation in focus yet. Try "Book a table for 4 tomorrow at 7:30 pm".
                  </p>
                )}
              </div>

              <div className="chat-assistant-sidepanel-section chat-assistant-sidepanel-order">
                <div>
                  <strong>Current Order</strong>
                  <span>Add dishes from the chat to build an order.</span>
                </div>
                {cart?.items?.length ? (
                  <div className="chat-assistant-order-list">
                    {cart.items.map((item) => (
                      <div className="chat-assistant-order-row" key={`${item.name}-${item.quantity}`}>
                        <span>{item.quantity} x {item.name}</span>
                        <span>{item.subtotal}</span>
                      </div>
                    ))}
                    <div className="chat-assistant-order-total">
                      <strong>Total</strong>
                      <strong>{cart.total}</strong>
                    </div>
                  </div>
                ) : (
                  <p className="chat-assistant-sidepanel-copy">
                    Your cart is empty right now. Try "Show the full menu" and tap + Add on a dish.
                  </p>
                )}
                <button type="button" className="chat-assistant-cta" onClick={() => sendMessage('Place my order')}>
                  Place order
                </button>
              </div>

              <div className="chat-assistant-sidepanel-section">
                <strong>Restaurant Snapshot</strong>
                <p className="chat-assistant-sidepanel-copy">
                  {assistantMeta.brand} support is available {assistantMeta.supportHours}. Reach the team at {assistantMeta.phone} or {assistantMeta.email}.
                </p>
                <div className="chat-assistant-branch-list">
                  {assistantMeta.branches.map((branch) => (
                    <article className="chat-assistant-branch-card" key={branch.name}>
                      <strong>{branch.name}</strong>
                      <span>{branch.address}</span>
                      <span>{branch.hours}</span>
                    </article>
                  ))}
                </div>
              </div>

              <div className="chat-assistant-sidepanel-section">
                <strong>Quick Answers</strong>
                <div className="chat-assistant-quick-grid">
                  <button type="button" className="chat-assistant-quick-card" onClick={() => sendMessage('Do you have vegetarian options?')}>
                    <strong>Do you have vegetarian options?</strong>
                    <span>See popular dishes and dietary-friendly picks.</span>
                  </button>
                  <button type="button" className="chat-assistant-quick-card" onClick={() => sendMessage('How do I contact support?')}>
                    <strong>How do I contact support?</strong>
                    <span>Get the phone number, email, and active support window.</span>
                  </button>
                  <button type="button" className="chat-assistant-quick-card" onClick={() => sendMessage('What are your hours?')}>
                    <strong>What are your hours?</strong>
                    <span>Check branch timings and current support availability.</span>
                  </button>
                </div>
              </div>

              <div className="chat-assistant-sidepanel-section">
                <strong>FAQ</strong>
                <p className="chat-assistant-sidepanel-copy">
                  Tap a frequent question to send it straight into the AI chat.
                </p>
                <div className="chat-assistant-branch-list">
                  {faqItems.map((faq) => (
                    <button
                      type="button"
                      className="chat-assistant-quick-card"
                      key={faq.question}
                      onClick={() => sendMessage(faq.question)}
                      disabled={isLoading}
                    >
                      <strong>{faq.question}</strong>
                      <span>{faq.answer}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="chat-assistant-sidepanel-footer">
                <span>Intent: {formatIntentLabel(lastIntent)}</span>
                <span>Order focus: {trackedOrderId}</span>
              </div>
            </aside>
          </div>
        </section>
      )}
    </div>
  );
};

export default ChatAssistant;
