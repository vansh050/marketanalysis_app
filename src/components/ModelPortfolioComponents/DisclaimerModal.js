"use client"
import { Modal, View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, Dimensions } from "react-native"
import { XIcon } from "lucide-react-native"

const { width: screenWidth, height: screenHeight } = Dimensions.get("window")

const DisclaimerModal = ({ visible, onClose, whiteLabelText = "Magnus" }) => {
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: "#f9f9f9",
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: "rgba(0, 0, 0, 0.1)",
      backgroundColor: "#fff",
    },
    headerTitle: {
      fontSize: 24,
      fontFamily: "Satoshi-Bold",
      color: "#1f2937",
    },
    closeButton: {
      padding: 8,
      borderRadius: 8,
      backgroundColor: "#f3f4f6",
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
      fontFamily: "Satoshi-Bold",
      color: "#1f2937",
      marginBottom: 8,
      lineHeight: 24,
    },
    paragraph: {
      fontSize: 14,
      fontFamily: "Satoshi-Regular",
      color: "#374151",
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
      fontFamily: "Satoshi-Bold",
      color: "#1f2937",
      marginRight: 8,
      marginTop: 2,
    },
    bulletText: {
      flex: 1,
      fontSize: 14,
      fontFamily: "Satoshi-Regular",
      color: "#374151",
      lineHeight: 22,
      textAlign: "justify",
    },
    linkText: {
      color: "#3b82f6",
      fontFamily: "Satoshi-Bold",
      textDecorationLine: "underline",
    },
    contentContainer: {
        paddingBottom: 40,
      },
  })

  const bulletPoints = [
    `Alireza Azar (Sole Proprietor) is registered with SEBI as Individual Research Analyst vide Registration number INH000016588 on June 24, 2024, pursuant to which it provides Research Analyst services to its clients.`,
    `I am not affiliated with any other intermediaries or receive any brokerage or commission from any third party.`,
    `The SEBI has issued no penalties/directions under the SEBI Act or any other regulatory body.`,
    `I do not recommend any stock broker or other intermediary to a client, nor do I receive any consideration by way of remuneration or compensation or in any other form whatsoever from the stock broker or another intermediary.`,
    `Investment in equity shares has its own risks. Sincere efforts have been made to present the right investment perspective. The information contained herein is based on analysis and on sources that I consider reliable. I, however, do not vouch for the consistency or the completeness thereof. This material is for personal information and I am not responsible for any loss incurred due to it & take no responsibility whatsoever for any financial profits or loss which may arise from the recommendations above.`,
    `I do not provide any promise or assurance of favourable view for a particular industry or sector or business group in any manner. The investor is requested to take into consideration all the risk factors including their financial condition and suitability to risk return profile before investing.`,
    `The information and views in my website & all the services I provide are believed to be reliable, but I do not accept any responsibility (or liability) for errors of fact or opinion. Users have the right to choose the product/s that suits them the most`,
    `I or any person related to me might be holding positions in the stocks recommended. The research recommendations are provided to all our clients who are entitled to receive the research reports. Any Client (Paid or Unpaid), Any third party or anyone else have no rights to forward or share our calls or SMS or Reports or Any Information Provided by us to/with anyone (through any medium) which is received directly or indirectly by them. If found so, then serious legal actions can be taken.`,
    `I ensure that the individuals employed as research analyst are separate from other employees who are performing sales trading, dealing, corporate finance advisory or any other activity that may affect the independence of our research report/recommendations. However, these individuals may receive feedback from sales or trading personnel of brokerage division to ascertain the impact of research report/recommendations.`,
    `I ensure that if a client wants an opinion on a specific position, such suggestion/view under any circumstances shall be considered as an opinion (not advice). I shall not be liable for any losses whatsoever the client may incur in accepting this opinion.`,
    `I do not have any association in any manner with any issuer of products/securities; this ensures that there are no actual or potential conflicts of interest. This also ensures that objectivity or independence in the carrying of research services is not compromised.`,
    `Investment in securities market is subject to market risks. Read all the related documents carefully before investing.`,
    `Registration granted by SEBI and certification from NISM is no way guarantee performance of the intermediary or provide any assurance of returns to investors.`,
    `By accessing Magnus hathway website or any of its associate/group sites, you have read, understood and agree to be legally bound by the terms of the following disclaimer and user agreement.`,
    `I have taken due care and caution in compilation of data for its website. I advises users to check with other certified experts before making any investment decision. However, I do not guarantee the consistency, adequacy or completeness of any information and is not responsible for any errors or omissions or for the results obtained from the use of such information. I especially states that I have no financial liability whatsoever to any user on account of the use of information provided on its website.`,
    `I shall not be responsible for any errors, omissions or representations on any of our pages or on any links on any of our pages. I do not endorse in any way any advertisers on our website pages. Please verify the veracity of all information on your own before undertaking any alliance.`,
    `The information on this website is updated from time to time. I, however, exclude any warranties (whether expressed or implied), as to the quality, consistency, efficacy, completeness, performance, fitness or any of the contents of the Website, including (but not limited) to any comments, feedback, and advertisements contained within the Site.`,
    `This website contains material in the form of inputs submitted by users and I accept no responsibility for the content or consistency of such content nor do I make any representations by virtue of the contents of this website in respect of the existence or availability of any goods and services advertised in the contributory sections. I make no warranty that the contents of the website are free from infection by viruses or anything else which has contaminating or destructive properties and shall have no liability in respect thereof.`,
    `Part of this website may contain advertising and other material submitted to us by third parties. Kindly note that those advertisers are responsible for ensuring that material submitted for inclusion on the website complies with all legal requirements.`,
    `Although acceptance of advertisements on the Website is subject to our terms and conditions which are available on request, I do not accept liability in respect of any advertisements.`,
    `There are risks associated with utilizing internet-based information and research dissemination services. Subscribers are advised to understand that the services can fail due to failure of hardware, software, and Internet connection. While I ensure that the messages are delivered in time to the subscriber's mobile network, the delivery of these messages to the customer's mobile phone/handset/desktop/iPad/tablet/laptop is the responsibility of the customer's mobile network/internet connection/wifi. The messages may be delayed and/or not delivered to the customer's mobile phone/handset on certain days, owing to technical reasons, and I shall not be held responsible for the same.`,
    `Stock trading is inherently risky, and you agree to assume complete and full responsibility for the outcomes of all trading decisions that you make.`,
    `Unlike an actual performance record, simulated results do not represent actual trading. No representation is being made that any account will or is likely to achieve profits or losses similar to those shown.`,
    `You, and not me, assume the entire cost and risk of any trading you choose to undertake. You are solely responsible for making your own investment decisions. If you choose to engage in transactions with or without seeking advice from a licensed and qualified financial advisor or entity, then such decision and any consequences flowing therefrom are your sole responsibility. I or my employees are in no way liable for the use of the information by others in investing or trading in investment vehicles.`,
    `I encourage all investors to use the services as a resource to further their own research on all featured companies, stocks, sectors, markets, and information presented on the site.`,
    `I take no responsibility for the veracity, validity, and correctness of the expert recommendations or other information or research. Although I attempt to research thoroughly on information provided herein, there are no guarantees of consistency. The information presented on the site has been gathered from various sources believed to be providing correct information. I shall not be responsible for errors, or inaccuracies, if any, in the content provided on the site.`,
    `I have the license to provide research recommendations as a research analyst. Your use of this and all information contained on this website is governed by these Terms and Conditions of Use. This material is based upon information that I consider reliable, but I do not represent that it is consistent or complete and that it should be relied upon, as such. You should not rely solely on the Information in making any investment. Rather, you should use the Information only as a starting point for doing additional independent research in order to allow you to form your own opinion regarding investments. By using Magnus hathway website including any software and content contained therein, you agree that use of the Service is entirely at your own risk. You understand and acknowledge that there is a very high degree of risk involved in trading securities. I make no warranties and give no assurances regarding the truth, timeliness, reliability, or good faith of any material posted on Magnus hathway website I do not warranty that trading methods or systems presented in their services or the information herein or obtained from advertisers or members will result in profits or losses.`,
    `By visiting the website Magnus hathway website, as a visitor and/or as a subscriber, surfing and reading the information on the website is the acceptance of this disclaimer and all other terms and conditions.`,
    `Everything posted on social media (Twitter/Facebook/Telegram/YouTube channel) is for education/illustration purposes and should not be counted as recommendations or investment advice.`,
    `I hereby expressly disclaim any implied warranties imputed by the laws of any jurisdiction. I consider myself and intend to be subject to the jurisdiction only of the courts of Magnus hathway website, in India. If you don't agree with any of our disclaimers above, please do not read the material on any of our pages. Although access to users outside India is not denied, I shall have no legal liabilities whatsoever in any laws of any jurisdiction other than India. I reserve the right to make changes to our site and these disclaimers, terms, and conditions at any time.`,
  ]

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Disclaimer</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <XIcon size={24} color="#6b7280" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.heading}>Market Risks:</Text>
            <Text style={styles.paragraph}>
              {whiteLabelText} Investments in the securities market are subject to market risks. Please read all
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
              As a SEBI-Registered Research Analyst, I am authorized to provide stock recommendations along with their
              buying and selling levels based on my research. I strictly follow all applicable rules and regulations and
              do not engage in any activity outside my permitted scope. I am not authorized to manage funds or accept
              money on behalf of any client. Please be vigilant and report any impersonators asking for money under my
              name
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
  )
}

export default DisclaimerModal
