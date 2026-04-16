import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { chat } from '../../services/ai';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  consultDoctor?: boolean;
}

const QUICK_PROMPTS = [
  'What are the side effects of ibuprofen?',
  'Can I take paracetamol and ibuprofen together?',
  'What should I do if I missed my dose?',
  'Is it safe to take antibiotics during pregnancy?',
];


export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content: 'Hi! I am your Medbro AI assistant 👋\n\nI can help you with medicine questions, dosage guidance, side effects, and general health queries. How can I help you today?',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  async function sendMessage(text?: string) {
    const messageText = text ?? input.trim();
    if (!messageText || loading) return;

    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: messageText };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    const response = await chat(newMessages.map(m => ({ role: m.role, content: m.content })));
    const aiMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: response.content,
      consultDoctor: response.consultDoctor,
    };
    setMessages((prev) => [...prev, aiMessage]);
    setLoading(false);

    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>🤖 Talk to AI</Text>
          <Text style={styles.headerSubtitle}>Ask anything about medicines & health</Text>
        </View>

        {/* Messages */}
        <ScrollView
          ref={scrollRef}
          style={styles.messages}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.map((msg) => (
            <View key={msg.id} style={[styles.bubble, msg.role === 'user' ? styles.userBubble : styles.aiBubble]}>
              {msg.role === 'assistant' && <Text style={styles.aiLabel}>Medbro AI</Text>}
              <Text style={[styles.bubbleText, msg.role === 'user' && styles.userBubbleText]}>
                {msg.content}
              </Text>
              {msg.consultDoctor && (
                <View style={styles.consultBanner}>
                  <Text style={styles.consultText}>
                    🏥 This may require a doctor's consultation. Please seek professional medical advice.
                  </Text>
                </View>
              )}
            </View>
          ))}

          {loading && (
            <View style={[styles.bubble, styles.aiBubble]}>
              <Text style={styles.aiLabel}>Medbro AI</Text>
              <Text style={styles.typing}>thinking...</Text>
            </View>
          )}

          {/* Quick prompts shown when only the intro message exists */}
          {messages.length === 1 && (
            <View style={styles.quickPrompts}>
              <Text style={styles.quickPromptsLabel}>Try asking:</Text>
              {QUICK_PROMPTS.map((prompt) => (
                <TouchableOpacity
                  key={prompt}
                  style={styles.quickPrompt}
                  onPress={() => sendMessage(prompt)}
                >
                  <Text style={styles.quickPromptText}>{prompt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>

        {/* Disclaimer */}
        <Text style={styles.disclaimer}>AI responses are informational only — not medical advice.</Text>

        {/* Input */}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Ask about medicines, dosages, symptoms..."
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
            onPress={() => sendMessage()}
            disabled={!input.trim() || loading}
          >
            <Text style={styles.sendBtnText}>➤</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.white,
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  headerSubtitle: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  messages: { flex: 1 },
  messagesContent: { padding: 16, paddingBottom: 8 },
  bubble: {
    maxWidth: '85%',
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
  },
  aiBubble: {
    backgroundColor: Colors.white,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: Colors.border,
    borderBottomLeftRadius: 4,
  },
  userBubble: {
    backgroundColor: Colors.primary,
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  aiLabel: { fontSize: 10, color: Colors.primary, fontWeight: '700', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 },
  bubbleText: { fontSize: 15, color: Colors.textPrimary, lineHeight: 22 },
  userBubbleText: { color: Colors.white },
  typing: { fontSize: 14, color: Colors.textMuted, fontStyle: 'italic' },
  consultBanner: {
    marginTop: 10,
    backgroundColor: '#FFF1F2',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#FFE4E6',
  },
  consultText: { fontSize: 13, color: '#9F1239', lineHeight: 18 },
  quickPrompts: { marginTop: 8 },
  quickPromptsLabel: { fontSize: 12, color: Colors.textMuted, marginBottom: 8, fontWeight: '600' },
  quickPrompt: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickPromptText: { fontSize: 14, color: Colors.primary, fontWeight: '500' },
  disclaimer: {
    textAlign: 'center',
    fontSize: 11,
    color: Colors.textMuted,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    paddingBottom: 14,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.textPrimary,
    maxHeight: 100,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: Colors.border },
  sendBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
});
