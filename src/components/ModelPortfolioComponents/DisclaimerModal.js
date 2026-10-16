"use client";
import { Modal, View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, Dimensions } from "react-native"
import { XIcon } from "lucide-react-native"

import { designColor, designFont } from '../../design/literalTokens';
import { useConfig } from '../../context/ConfigContext';

const { width: screenWidth, height: screenHeight } = Dimensions.get("window")

// Advisor identity comes from the app config (advisor_config.company_name /
// sebi_ra_number). Until 2026-10-16 this modal hardcoded one advisor's name,
// SEBI registration (INH000016588) and website for EVERY tenant, plus
// first-person claims about that advisor (no affiliations, no penalties, own
// holdings) that no other advisor had made. Only advisor-neutral statements
// remain; advisor-specific declarations belong in the advisor's own terms.
export const buildDisclaimerPoints = ({ advisorName, sebiRaNumber }) => {
  const points = [];
  if (sebiRaNumber) {
    points.push(`${advisorName} is registered with SEBI as a Research Analyst, Registration No. ${sebiRaNumber}.`);
  }
  points.push(
    `Investment in securities market is subject to market risks. Read all the related documents carefully before investing.`,
    `Registration granted by SEBI and certification from NISM in no way guarantee performance of the intermediary or provide any assurance of returns to investors.`,
    `The research recommendations are provided only to clients entitled to receive them. Recommendations, reports and other information received from ${advisorName} must not be forwarded or shared with anyone, through any medium.`,
    `Stock trading is inherently risky, and you agree to assume complete and full responsibility for the outcomes of all trading decisions that you make.`,
    `Unlike an actual performance record, simulated results do not represent actual trading. No representation is being made that any account will or is likely to achieve profits or losses similar to those shown.`,
    `Everything posted on social media (Twitter/Facebook/Telegram/YouTube channel) is for education/illustration purposes and should not be counted as recommendations or investment advice.`,
  );
  return points;
};

const DisclaimerModal = ({ visible, onClose, whiteLabelText = "" }) => {
  const config = useConfig() || {};
  const advisorName = config.legalName || whiteLabelText || "The research analyst";
  const sebiRaNumber = config.sebiRaNumber || null;
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: designColor('f9f9f9'),
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: "rgba(0, 0, 0, 0.1)",
      backgroundColor: designColor('fff'),
    },
    headerTitle: {
      fontSize: 24,
      fontFamily: designFont('Satoshi-Bold'),
      color: designColor('1f2937'),
    },
    closeButton: {
      padding: 8,
      borderRadius: 8,
      backgroundColor: designColor('f3f4f6'),
    },
    content: {
      flex: 1,
      paddingHorizontal: 20,
      paddingVertical: 24,
    },
    section: {
      marginBottom: 16,
    },
    heading: {
      fontSize: 16,
      fontFamily: designFont('Satoshi-Bold'),
      color: designColor('1f2937'),
      marginBottom: 8,
      lineHeight: 24,
    },
    paragraph: {
      fontSize: 14,
      fontFamily: designFont('Satoshi-Regular'),
      color: designColor('374151'),
      lineHeight: 22,
      textAlign: "justify",
    },
    bulletPoint: {
      flexDirection: "row",
      marginBottom: 12,
      alignItems: "flex-start",
    },
    bullet: {
      fontSize: 16,
      fontFamily: designFont('Satoshi-Bold'),
      color: designColor('1f2937'),
      marginRight: 8,
      marginTop: 2,
    },
    bulletText: {
      flex: 1,
      fontSize: 14,
      fontFamily: designFont('Satoshi-Regular'),
      color: designColor('374151'),
      lineHeight: 22,
      textAlign: "justify",
    },
    linkText: {
      color: designColor('3b82f6'),
      fontFamily: designFont('Satoshi-Bold'),
      textDecorationLine: "underline",
    },
    contentContainer: {
        paddingBottom: 40,
      },
  })

  const bulletPoints = buildDisclaimerPoints({ advisorName, sebiRaNumber })

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Disclaimer</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <XIcon size={24} color={designColor('6b7280')} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.heading}>Market Risks:</Text>
            <Text style={styles.paragraph}>
              Investments in the securities market are subject to market risks. Please read all
              relevant security-related documents carefully before investing
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.heading}>Performance & Guarantees:</Text>
            <Text style={styles.paragraph}>
              Registration with SEBI and certification from NISM do not guarantee performance or ensure any specific
              returns. There are no guaranteed or fixed returns in the stock market. Past performance is not indicative
              of future results, as market conditions can change unpredictably
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.heading}>Non-Refundable Subscription:</Text>
            <Text style={styles.paragraph}>
              All subscription fees for research recommendations are non-refundable under any circumstances
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.heading}>No Profit-Sharing Model:</Text>
            <Text style={styles.paragraph}>
              Our fees and subscription charges are fixed; we do not operate on a profit-sharing or performance-based
              model
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.heading}>No Liability for Losses:</Text>
            <Text style={styles.paragraph}>
              We are not responsible for any financial loss or other damages incurred by clients. Trading and investing
              should align with your risk appetite and financial goals
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.heading}>Confidentiality:</Text>
            <Text style={styles.paragraph}>
              All recommendations and reports are confidential and intended solely for subscribed members. Unauthorized
              sharing or distribution of our recommendations will be treated as a breach of confidentiality and may lead
              to legal action
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.heading}>Nature of Recommendations:</Text>
            <Text style={styles.paragraph}>
              Our recommendations may be based on technical, fundamental, or a combination of both approaches. While we
              strive to provide accurate insights, we do not guarantee outcomes
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.heading}>SEBI Compliance & Legal Boundaries:</Text>
            <Text style={styles.paragraph}>
              {advisorName} is a SEBI-registered Research Analyst{sebiRaNumber ? ` (Registration No. ${sebiRaNumber})` : ''},
              authorised to provide stock recommendations with buying and selling levels based on its research. It is
              not authorised to manage funds or accept money on behalf of any client. Please be vigilant and report
              anyone asking for money in its name
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.heading}>Responsibility for Errors:</Text>
            <Text style={styles.paragraph}>
              While we ensure that all content is reliable and accurate, we are not responsible for errors, omissions,
              or opinions expressed. Clients must conduct their own due diligence before acting on any advice provided
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.heading}>Internet-Based Risks:</Text>
            <Text style={styles.paragraph}>
              Our service relies on internet-based platforms for message dissemination. Delays or failures in message
              delivery due to network issues, hardware, or software malfunctions are beyond our control, and we bear no
              responsibility for such occurrences
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.heading}>No Inducements:</Text>
            <Text style={styles.paragraph}>
              We do not promise or induce clients with guaranteed profits. All investment decisions are taken at your
              discretion and risk
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.heading}>Client Responsibility:</Text>
            <Text style={styles.paragraph}>
              You assume full responsibility for the outcomes of your trading and investment decisions, whether made
              independently or with our recommendations. Choosing to act on our recommendations is entirely at your own
              risk
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.heading}>Service Delivery:</Text>
            <Text style={styles.paragraph}>
              We endeavor to deliver recommendations promptly, but we are not liable for message delays or delivery
              issues caused by your network provider or internet connection. It is the client's responsibility to ensure
              proper network conditions for receiving updates
            </Text>
          </View>

          {bulletPoints.map((point, index) => (
            <View key={index} style={styles.bulletPoint}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.bulletText}>{point}</Text>
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

export default DisclaimerModal
