import React, { useState, useRef,useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, Dimensions,ScrollView, Linking } from 'react-native';
import Modal from 'react-native-modal';
import YoutubePlayer from "react-native-youtube-iframe";
import { ChevronLeft,XIcon,ChevronDown,ChevronUp, ClipboardList } from 'lucide-react-native';
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
import Config from 'react-native-config';
import LinkifiedUrl from '../../UIComponents/BrokerConnectionUI/HelpUI/LinkifiedUrl';
const HelpModal = ({ broker, visible, onClose }) => {
  const [mpin, setMpin] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const brokerConnectRedirectURL=Config.REACT_APP_BROKER_CONNECT_REDIRECT_URL;
  const scrollViewRef = useRef(null);
  const handleSubmitOtp = async () => {
    setLoading(true);
    // Make sure to define submitOtp elsewhere
    await submitOtp();
    setLoading(false);
  };

    const [isOpen, setIsOpen] = useState(false);
  
    const toggleOpen = () => {
      setIsOpen(!isOpen);
    };
  
    const handleCopy = (text) => {
      Clipboard.setString(text);
      Alert.alert("Copied", "Link copied to clipboard!");
    };
  


  return (
    <Modal
      isVisible={visible}
      onBackdropPress={onClose}
      onBackButtonPress={onClose}
      onSwipeComplete={onClose}
      swipeDirection={['down']}
      style={styles.modal}
      propagateSwipe={true}
      useNativeDriverForBackdrop={true}
    >
      <View style={styles.modalContainer}>
        <View style={styles.sheet}>
            
      
            {(broker === 'ICICI') && (
          <>
          <View style={{flexDirection:'row',marginTop:20,}}>
            <ChevronLeft onPress={onClose} size={24} color={'grey'}/>
            <Text style={styles.title}>ICICI: Steps to get API & Secret Key</Text>
            <TouchableOpacity onPress={onClose} style={{position: 'absolute', right: 10}}>
           <XIcon size={24} color="#000" />
        </TouchableOpacity>
            </View>
             <ScrollView
              ref={scrollViewRef}
              nestedScrollEnabled
              contentInset={{ bottom: 20 }}
              contentContainerStyle={{flexGrow: 1,paddingBottom:200}}
              indicatorStyle='black'
              >
                <View style={{flex:0,}}>
            <View style={styles.playerWrapper}>
              <YoutubePlayer
                height={screenHeight * 0.23}
                width={screenWidth * 0.85}
                play={false}
                videoId="XFLjL8hOctI"
              />
            </View>
            <View style={styles.content}>
              <Text style={styles.instruction}>
                1. Visit{" "}
                <LinkifiedUrl url="https://api.icicidirect.com/apiuser/home" />{" "}
                and log in using your username and password. Verify your identity with the OTP and submit.
              </Text>
              <Text style={styles.instruction}>
                2. Click on the "Register an App" tab, then fill in the "App Name" field with "{Config?.REACT_APP_WHITE_LABEL_TEXT || 'AlphaQuark'}" or a name of
                your choice. Enter the "Redirect URL" as{" "}
                <LinkifiedUrl url={brokerConnectRedirectURL} />{" "}
                and click "Submit". Please ensure that "redirect URL" is entered correctly as mentioned above.
              </Text>
              <Text style={styles.instruction}>
                3. Navigate to the "View Apps" tab and copy your API and Secret Key- enter these details on the screen.
              </Text>
            </View>
            </View>
            </ScrollView>
          </>
        )}

        {(broker === 'AliceBlue') && (
          <>
           <View style={{flexDirection:'row',marginTop:20,}}>
            <ChevronLeft onPress={onClose} size={24} color={'grey'}/>
            <Text style={styles.title}>AliceBlue: Steps to User ID & API Key</Text>
            <TouchableOpacity onPress={onClose} style={{position: 'absolute', right: 10}}>
           <XIcon size={24} color="#000" />
        </TouchableOpacity>
            </View>
          <ScrollView
               ref={scrollViewRef}
               nestedScrollEnabled
               contentInset={{ bottom: 20 }}
               contentContainerStyle={{flexGrow: 1,paddingBottom:200}}
               indicatorStyle='black'
              >
                <View style={{flex:0,}}>
            <View style={styles.playerWrapper}>
            <YoutubePlayer
                  height={screenHeight * 0.23}
                  width={screenWidth * 0.85}
                  play={false}
                  videoId={"m906oWzMe0o"}
                />
            </View>

            <View style={styles.content}>
            <Text
              style={styles.instruction}
            >
              1. Visit{" "}
              <LinkifiedUrl url="https://ant.aliceblueonline.com/apps" />{' '}
              with your phone number, password, and TOTP or mobile OTP.
            </Text>
          
            <Text style={styles.instruction}>
              2. If prompted with a Risk Disclosure pop-up, click "Proceed."
            </Text>
            <Text style={styles.instruction}>
              3. In the "Apps" tab, select "API Key," click "Copy," and paste it on your platform. Note: This key is valid for 24 hours, so generate a new one daily.
            </Text>
            <Text style={styles.instruction}>
              4. For your User ID, click the profile icon, go to "Your Profile/Settings," and copy the client ID under your name. Paste it onto your platform.
            </Text>
            </View>
  
            </View>
            </ScrollView>
          </>
        )}

{(broker === 'Fyers') && (
          <>
           <View style={{flexDirection:'row',marginTop:20,}}>
            <ChevronLeft onPress={onClose} size={24} color={'grey'}/>
            <Text style={styles.title}>Fyers: Steps to APP ID & Secret ID</Text>
            <TouchableOpacity onPress={onClose} style={{position: 'absolute', right: 10}}>
           <XIcon size={24} color="#000" />
        </TouchableOpacity>
            </View>
          <ScrollView
               ref={scrollViewRef}
               nestedScrollEnabled
               contentInset={{ bottom: 20 }}
               contentContainerStyle={{flexGrow: 1,paddingBottom:200}}
               indicatorStyle='black'
              >
                <View style={{flex:0,}}>
            <View style={styles.playerWrapper}>
            <YoutubePlayer
                  height={screenHeight * 0.23}
                  width={screenWidth * 0.85}
                  play={false}
                  videoId={"blhTiePBIg0"}
                />
            </View>
            <View style={styles.content}>
            <Text
              style={styles.instruction}
            >
              1. Visit{" "}
              <LinkifiedUrl url="https://fyers.in/web/api-dashboard/user-apps" />{' '}
              (the new Fyers API dashboard — required for static-IP whitelisting)
            </Text>
            <Text style={styles.instruction}>
              2. Log in using your phone number, enter the TOTP, and your 4-digit PIN.
            </Text>
            <Text style={styles.instruction}>
              3. Click "Create App". Provide an app name, paste the redirect URL as specified in the instructions, add a description, and delete the webhook. {"\n\n"}
              ⚠️ <Text style={{fontWeight: '700'}}>You MUST tick the "Order Placement" permission</Text> — without it Fyers rejects every basket order with "algo orders are not allowed for this app". The checkbox is OFF by default. {"\n\n"}
              Tick all other permissions you want, accept the API Usage Terms and Conditions, click "Create App", and on the next screen add your AlphaQuark egress IP under "IP Whitelist" (the address shown in the IP-whitelist callout on the connect page).
            </Text>
            <Text style={styles.instruction}>
              4. Scroll down to find the newly created app. Copy the App ID and Secret ID and paste them into your platform.
            </Text>
            </View>
            </View>
            </ScrollView>
          </>
        )}



{(broker === 'Dhan') && (
          <>
           <View style={{flexDirection:'row',marginTop:20,}}>
            <ChevronLeft onPress={onClose} size={24} color={'grey'}/>
            <Text style={styles.title}>Dhan: Steps to Client ID & Access Token</Text>
            <TouchableOpacity onPress={onClose} style={{position: 'absolute', right: 10}}>
           <XIcon size={24} color="#000" />
        </TouchableOpacity>
            </View>
          <ScrollView
               ref={scrollViewRef}
               nestedScrollEnabled
               contentInset={{ bottom: 20 }}
               contentContainerStyle={{flexGrow: 1,paddingBottom:200}}
               indicatorStyle='black'
              >
                <View style={{flex:0,}}>
            <View style={styles.playerWrapper}>
            <YoutubePlayer
                  height={screenHeight * 0.23}
                  width={screenWidth * 0.85}
                  play={false}
                  videoId={"MhAfqNQKSrQ"}
                />
            </View>
            <View style={styles.content}>
            <Text
              style={styles.instruction}
            >
              1. Go to{" "}
              <LinkifiedUrl url="https://login.dhan.co" />{' '}
            </Text>
            <Text style={styles.instruction}>
              2. Click on your profile picture and choose "My Profile on Dhan". Under the Profile details, you'll find the "Client ID".
            </Text>
            <Text style={styles.instruction}>
              3. Then, select "Dhan HQ Trading APIs" from the menu.
            </Text>
            <Text style={styles.instruction}>
              4. To generate an access token, click on "+ New Token," enter a name for your app, set the validity to 30 days, and click "Generate Token."
            </Text>
            <Text style={styles.instruction}>
              5. Copy the access token and paste it into the designated field.
            </Text>
            </View>
            </View>
            </ScrollView>
          </>
        )}

        {(broker === 'HDFC') && (
          <>
           <View style={{flexDirection:'row',marginTop:20,}}>
            <ChevronLeft onPress={onClose} size={24} color={'grey'}/>
            <Text style={styles.title}>HDFC: Steps to get API & Secret Key</Text>
            <TouchableOpacity onPress={onClose} style={{position: 'absolute', right: 10}}>
           <XIcon size={24} color="#000" />
        </TouchableOpacity>
            </View>
                    <ScrollView
                ref={scrollViewRef}
                nestedScrollEnabled
                contentInset={{ bottom: 20 }}
                contentContainerStyle={{flexGrow: 1,paddingBottom:200}}
                indicatorStyle='black'
              >
                <View style={{flex:0,}}> 
            <View style={styles.playerWrapper}>
              <YoutubePlayer
                height={screenHeight * 0.23}
                width={screenWidth * 0.85}
                play={false}
                videoId="XFLjL8hOctI"
              />
            </View>
            <View style={styles.content}>
            <Text
                style={styles.instruction}
              >
                1. Go to{" "}
                <LinkifiedUrl url="https://developer.hdfcsec.com/" />
              </Text>
              <Text style={styles.instruction}>
                2. Log in with your ID, password, and OTP.
              </Text>
              <Text style={styles.instruction}>
                3. Accept the *Risk Disclosure *.
              </Text>
              <Text style={styles.instruction}>
                4. Click *Create* to make a new app. Enter app
name, redirect URL: {' '}
<LinkifiedUrl url={brokerConnectRedirectURL} />
{' '}and description, then click *Create *.
              </Text>
              <Text style={styles.instruction}>
                5. Copy the *API* and *Secret Key* and paste
them into the {Config?.REACT_APP_WHITE_LABEL_TEXT || 'AlphaQuark'} platform to connect
your broker.
              </Text>
            </View>
            </View>
            </ScrollView>
          </>
        )}
        {broker === 'Kotak' && (
  <>
    <View style={{ flexDirection: "row", marginTop: 20, alignItems: "center" }}>
      <Text
        style={{
          fontSize: 16,
          marginHorizontal: 40,
          fontWeight: "bold",
          color: "black",
        }}
      >
        Kotak: Steps to get Consumer Key & Consumer Secret
      </Text>
      <TouchableOpacity onPress={onClose}>
        <XIcon size={24} color="#000" />
      </TouchableOpacity>
    </View>

    <ScrollView
      ref={scrollViewRef}
      nestedScrollEnabled
      contentInset={{ bottom: 20 }}
      contentContainerStyle={{ flexGrow: 1, paddingBottom: 200 }}
      indicatorStyle='black'
    >
      <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
        <View style={styles.playerWrapper}>
          <YoutubePlayer
            height={screenHeight * 0.23}
            width={screenWidth * 0.85}
            play={false}
            videoId="JXwnwaxM88k"
          />
        </View>

        {/* STEP 1 */}
        <Text style={styles.instruction}>Step 1: Getting NEO trade API access</Text>

        {/* Substep i */}
        <Text style={styles.instruction1}>
          (i) Check if you are using Kotak NEO or Kotak Stock trader. If you are using Kotak NEO, please obtain your Client ID by logging into Kotak Neo account and finding your Client ID under account details.
        </Text>

        {/* Substep ii */}
        <Text style={styles.instruction1}>
          (ii) After that, please login to:
        </Text>

        <View style={styles.linkContainer}>
          <LinkifiedUrl url="https://www.kotaksecurities.com/platform/kotak-neo-trade-api/" />
        </View>

        <Text style={styles.instruction1}>
          Login with your mobile number and register for Kotak Neo Trade API. Enter your Client ID, email, and contact number, then click "Submit." You'll receive your User ID, password, and Neo Finkey via email within 30 minutes.
        </Text>

        {/* Substep iii */}
        <Text style={styles.instruction1}>
          (iii) If you are using Kotak Stock Trader, kindly switch to Neo:
        </Text>

        <View style={styles.linkContainer}>
          <LinkifiedUrl url="https://www.kotaksecurities.com/switch-to-neo/" />
        </View>

        {/* STEP 2 */}
        <Text style={styles.instruction}>Step 2: Setting API access - Getting consumer key and consumer secret keys</Text>

        <Text style={styles.instruction1}>
          (i) Log In to the Kotak API Portal:
        </Text>

        <View style={styles.linkContainer}>
          <LinkifiedUrl url="https://napi.kotaksecurities.com/devportal/apis" />
        </View>

        <Text style={styles.instruction1}>
          Login using the username and password you received via email.
        </Text>

        <Text style={styles.instruction1}>
          (ii) Create an Application: Navigate to the "Applications" section, click on "Add New Application," and fill required details (use any app name, e.g., {Config?.REACT_APP_WHITE_LABEL_TEXT || 'AlphaQuark'}). Select Unlimited in Shared Quota, leave description & group empty, then save.
        </Text>

        <Text style={styles.instruction1}>
          (iii) Under "Subscriptions" section, click on Subscribe APIs and subscribe to all available APIs.
        </Text>

        <Text style={styles.instruction1}>
          (iv) Go to "Production Keys", click "Generate Keys" to obtain your API Key & Secret Key. Copy Consumer Key & Secret for Step 4.
        </Text>

        {/* STEP 3 */}
        <Text style={styles.instruction}>Step 3: TOTP Registration</Text>

        <Text style={styles.instruction1}>
          (i) Go to:
        </Text>

        <View style={styles.linkContainer}>
          <LinkifiedUrl url="https://www.kotaksecurities.com/platform/kotak-neo-trade-api/totp-registration/" />
        </View>

        <Text style={styles.instruction1}>
          Register for TOTP, verify mobile via OTP, select account, scan QR via authenticator app (e.g. Google Authenticator), and submit TOTP.
        </Text>

        {/* STEP 4 */}
        <Text style={styles.instruction}>Step 4: Linking account to Kotak NEO Apis</Text>

        <Text style={styles.instruction1}>
          (i) Go to broker settings in your app, select Kotak, and input Unique Client Code, Consumer Key & Secret obtained earlier, and your MPIN.
        </Text>

        <Text style={styles.instruction1}>
          (ii) You'll need to provide TOTP from Authenticator app while linking.
        </Text>
      </View>
    </ScrollView>
  </>
)}

        {(broker === 'Upstox') && (
          <>
            <View style={{flexDirection:'row',marginTop:20,}}>
            <ChevronLeft onPress={onClose} size={24} color={'grey'}/>
            <Text style={styles.title}>Upstox: Steps to get API & Secret Key</Text>
            <TouchableOpacity onPress={onClose} style={{position: 'absolute', right: 10}}>
           <XIcon size={24} color="#000" />
        </TouchableOpacity>
            </View>
              <ScrollView
                ref={scrollViewRef}
              nestedScrollEnabled
              contentInset={{ bottom: 20 }}
              contentContainerStyle={{flexGrow: 1,paddingBottom:200}}
              indicatorStyle='black'
              >
                <View style={{flex:0,}}>
            <View style={styles.playerWrapper}>
            <YoutubePlayer
              height={screenHeight * 0.23}
              width={screenWidth * 0.85}
              play={false}
              videoId={"yfTXrjl0k3E"}
            />
            </View>
            <View style={styles.content}>
            <Text
              style={styles.instruction}
            >
              1. Visit{" "}
              <LinkifiedUrl url="https://shorturl.at/plWYJ" />{' '}
and log in with your phone number. Verify your identity with the OTP
and continue.
            </Text>
            <Text style={styles.instruction}>
              2. Enter your 6-digit PIN and continue.
            </Text>
            <Text style={styles.instruction}>
              3. Click on the "New App" button. Fill in the "App Name"
field with "{Config?.REACT_APP_WHITE_LABEL_TEXT || 'AlphaQuark'}" or a name of your choice.
Enter the "Redirect URL" as <LinkifiedUrl url={brokerConnectRedirectURL} />
{' '} You can skip the Postback URL and Description as
they are optional. Accept the Terms & Conditions
and click on the "Continue" button. Please ensure that
the "Redirect URL" is entered correctly as mentioned
above.
            </Text>

            
            <Text style={styles.instruction}>
              4. Review the details (make sure you don't have more
than 2 apps) and click on the "Confirm Plan" button.
Your API is now ready! Click on the "Done" button.
            </Text>
            <Text style={styles.instruction}>
              5. Click on the newly created app, copy your API and
Secret Key, and enter these details on the
designated screen.
            </Text>
            </View>
            </View>
          </ScrollView>
        
          </>
        )}
        {broker === 'Motilal' && (
  <>
    <View style={{ flexDirection: 'row', marginTop: 20 }}>
      <ChevronLeft onPress={onClose} size={24} color={'grey'} />
      <Text style={styles.title}>Motilal: Steps to get API & Secret Key</Text>
      <TouchableOpacity onPress={onClose} style={{ position: 'absolute', right: 10 }}>
        <XIcon size={24} color="#000" />
      </TouchableOpacity>
    </View>

    <ScrollView
      ref={scrollViewRef}
      nestedScrollEnabled
      contentInset={{ bottom: 20 }}
      contentContainerStyle={{ flexGrow: 1, paddingBottom: 200 }}
      indicatorStyle='black'
    >
      <View style={{ flex: 0 }}>
        <View style={styles.playerWrapper}>
          <YoutubePlayer
            height={screenHeight * 0.23}
            width={screenWidth * 0.85}
            play={false}
            videoId={"gGKedxU-sQ0"}
          />
        </View>

        <View style={styles.content}>

          {/* STEP 1 */}
          <Text style={styles.instruction}>
            1. Visit{' '}
            <LinkifiedUrl url="https://www.motilaloswal.com" />{' '}
            in your browser.
          </Text>

          {/* STEP 2 */}
          <Text style={styles.instruction}>
            2. Click on <Text style={{ fontWeight: 'bold' }}>Customer Login</Text> at the top right, then select the Older Version to log into your account.
          </Text>

          {/* STEP 3 */}
          <Text style={styles.instruction}>
            3. Click on <Text style={{ fontWeight: 'bold' }}>Profile Icon</Text> at the top to get Client Code.
          </Text>

          {/* STEP 4 */}
          <Text style={styles.instruction}>
            4. Click on the <Text style={{ fontWeight: 'bold' }}>hamburger menu (☰)</Text> at the top right corner.
          </Text>

          {/* STEP 5 */}
          <Text style={styles.instruction}>
            5. From the dropdown list, select <Text style={{ fontWeight: 'bold' }}>"Trading API"</Text>.
          </Text>

          {/* STEP 6 */}
          <Text style={styles.instruction}>
            6. On the Trading API page, click on <Text style={{ fontWeight: 'bold' }}>"Create an API Key"</Text>. 
            Enter a name for your app (e.g., {Config?.REACT_APP_WHITE_LABEL_TEXT || 'AlphaQuark'}) and enter the Redirect URL below:
          </Text>

          <View style={styles.linkContainer}>
            <LinkifiedUrl url="https://ccxtprod.alphaquark.in/motilal-oswal/callback" />
          </View>

          <Text style={styles.instruction}>
            Copy this URL and paste it in the Redirect URL field, then hit <Text style={{ fontWeight: 'bold' }}>"Create"</Text>.
          </Text>

          {/* STEP 7 */}
          <Text style={styles.instruction}>
            7. Your API Key is now created. Copy the <Text style={{ fontWeight: 'bold' }}>API Key</Text> and your Client Code.
          </Text>

          {/* STEP 8 */}
          <Text style={styles.instruction}>
            8. Paste these details in our app to complete your broker connection.
          </Text>
        </View>
      </View>
    </ScrollView>
  </>
)}

  {broker === 'Zerodha' && (
  <>
    <View style={{ flexDirection: 'row', marginTop: 20 }}>
      <ChevronLeft onPress={onClose} size={24} color={'grey'} />
      <Text style={styles.title}>Zerodha: Steps to get API & Secret Key</Text>
      <TouchableOpacity onPress={onClose} style={{ position: 'absolute', right: 10 }}>
        <XIcon size={24} color="#000" />
      </TouchableOpacity>
    </View>

    <ScrollView
      ref={scrollViewRef}
      nestedScrollEnabled
      contentInset={{ bottom: 20 }}
      contentContainerStyle={{ flexGrow: 1, paddingBottom: 200 }}
      indicatorStyle='black'
    >
      <View style={{ flex: 0 }}>
        <View style={styles.playerWrapper}>
          <YoutubePlayer
            height={screenHeight * 0.23}
            width={screenWidth * 0.85}
            play={false}
            videoId={"tqJTYfgkS04"} // You can replace with Zerodha video if you have
          />
        </View>

        <View style={styles.content}>

          {/* STEP 1 */}
          <Text style={styles.instruction}>
            1. Visit{' '}
            <LinkifiedUrl url="https://developers.kite.trade/apps" />{' '}in your browser and sign up/login with your credentials.
          </Text>

          {/* STEP 2 */}
          <Text style={styles.instruction}>
            2. Locate and click on the <Text style={{ fontWeight: 'bold' }}>Create New App</Text> button in the top-right corner of the dashboard.
          </Text>

          {/* STEP 3 */}
          <Text style={styles.instruction}>
            3. Configure your application with these details:
          </Text>
          <Text style={styles.instruction1}>- Select <Text style={{ fontWeight: 'bold' }}>Personal</Text> for application type.</Text>
          <Text style={styles.instruction1}>- Enter a descriptive name for your application.</Text>
          <Text style={styles.instruction1}>- Input your <Text style={{ fontWeight: 'bold' }}>Zerodha Client ID</Text>.</Text>
          <Text style={styles.instruction1}>- Set the Redirect URL to:</Text>

          <View style={styles.linkContainer}>
            <LinkifiedUrl url="https://ccxtprod.alphaquark.in/zerodha/callback" />
          </View>

          <Text style={styles.instruction1}>- Set the Postback URL to:</Text>

          <View style={styles.linkContainer}>
            <LinkifiedUrl url="https://ccxtprod.alphaquark.in/zerodha/postback" />
          </View>

          <Text style={styles.instruction1}>- Provide a brief description (e.g., "Trading advisory application for client portfolio management").</Text>
          <Text style={styles.instruction1}>- Click <Text style={{ fontWeight: 'bold' }}>Create</Text> to submit your application.</Text>

          {/* STEP 4 */}
          <Text style={styles.instruction}>
            4. Retrieve and secure your API credentials:
          </Text>
          <Text style={styles.instruction1}>- You will be redirected to the applications dashboard.</Text>
          <Text style={styles.instruction1}>- Click on your newly created application to view its details.</Text>
          <Text style={styles.instruction1}>- Locate your <Text style={{ fontWeight: 'bold' }}>API Key</Text> on this page.</Text>
          <Text style={styles.instruction1}>- Click <Text style={{ fontWeight: 'bold' }}>Show Secret</Text> to reveal your API Secret.</Text>
          <Text style={styles.instruction1}>- Securely copy both your <Text style={{ fontWeight: 'bold' }}>API Key</Text> and <Text style={{ fontWeight: 'bold' }}>API Secret</Text>.</Text>

          {/* STEP 5 */}
          <Text style={styles.instruction}>
            5. Paste these details in our app to complete your Zerodha API integration.
          </Text>
        </View>
      </View>
    </ScrollView>
  </>
)}


 
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
    modal: {
        justifyContent: 'flex-end',
        margin: 0,
    },
    modalContainer: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: screenHeight * 0.85,
    },
    sheet: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,

      },
      content: {
          paddingHorizontal:30,
       
      },
      content1: {
        justifyContent:'center'
    },
    closeButton: { position: 'absolute', top: 10, right: 10 },
    
     
      title: {
        fontSize: 16,
        marginHorizontal:10,
        fontWeight: "bold",
        color: 'black',
        marginBottom: 15,
      },
      playerWrapper: {
        overflow: 'hidden',
        marginTop: 20,
        alignSelf: 'center',
        borderRadius: 20,
        marginBottom: 20,
      },
      instruction: {
        fontSize: 15,
        color: "black",
        marginVertical: 3,
        fontFamily:'Poppins-Regular'
      },
      instruction1: {
        fontSize: 12,
        color: "black",
        marginVertical: 3,
        fontFamily:'Poppins-Regular'
      },
      link: {
        color: "#1890FF",
     
      },
      stepGuide: {
        fontSize: 16,
        color:'black',
        marginRight:10,
        marginLeft:10,
        fontFamily:'Poppins-SemiBold'
      },
      label: {
        fontSize: 17,
        fontWeight: "bold",
        color: 'black',
        marginHorizontal:10,
        marginBottom: 5,
      },
   
      proceedButtonText: {
        fontSize: screenWidth * 0.045,
        fontWeight: '600',
        color: 'white',
      },
      webViewContainer: {
        backgroundColor: "#fff",
        marginTop:20,
        height: screenHeight / 1.7,
        borderTopLeftRadius: 100,
        borderTopRightRadius: 100,
      },
      webView: {
        flex: 1,
      },
});

export default HelpModal;