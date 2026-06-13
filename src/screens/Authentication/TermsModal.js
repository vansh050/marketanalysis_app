/**
 * TermsModal — container (Phase F, 2026-05-01)
 *
 * Holds the hardcoded terms-of-service text and exposes the same legacy
 * prop signature consumers expect: { modalVisible, setModalVisible,
 * setIsChecked }. Renders presentation resolved as
 * `composites.TermsModal`.
 */

import React from 'react';
import { Text } from 'react-native';
import { useComponent } from '../../design/useDesign';

const TERMS_DATA = [
    {
        heading: 'Acceptance of Terms',
        text: '1.1. By accessing or using the Service, you acknowledge that you have read, understood, and agree to be bound by these Terms.\n\n1.2. We may update these Terms from time to time. The revised Terms will be effective immediately upon posting. Your continued use of the Service after any such changes constitutes your acceptance of the new Terms.',
    },
    {
        heading: 'Description of Service',
        text: '2.1. This service is a financial technology software designed to enable financial advisors to send investment recommendations to their clients and facilitate the execution of these recommendations.\n\n2.2. The Service is currently in its launch stage. As such, it may contain minor issues that could affect its performance. We make no guarantees about the availability, reliability, or accuracy of the Service.',
    },
    {
        heading: 'User Responsibilities',
        text: '3.1. You agree to use the Service only for lawful purposes and in accordance with these Terms.\n\n3.2. You must be at least 18 years old or have the consent of a parent or guardian to use the Service.\n\n3.3. You are responsible for maintaining the confidentiality of your account information, including your username and password, and for all activities that occur under your account.\n\n3.4. You agree to notify us immediately of any unauthorized use of your account or any other breach of security.',
    },
    {
        heading: 'Subscription and Payment',
        text: '4.1. The Service is offered on a subscription basis. Subscription fees and payment terms will be specified at the time of purchase.\n\n4.2. All payments are due in advance and are non-refundable except as required by applicable law.\n\n4.3. We reserve the right to change our fees at any time. Any changes will be communicated to you in advance.',
    },
    {
        heading: 'Limitation of Liability',
        text: '5.1. To the fullest extent permitted by law, we will not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of profits, data, or other intangible losses, arising out of or in connection with your use of the Service.\n\n5.2. We disclaim all warranties, whether express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, and non-infringement.',
    },
    {
        heading: 'Indemnification',
        text: '6.1. You agree to indemnify, defend, and hold harmless our company, its affiliates, officers, directors, employees, and agents from and against any claims, liabilities, damages, losses, or expenses, including reasonable attorneys’ fees, arising out of or in connection with your use of the Service, your violation of these Terms, or your infringement of any rights of another party.',
    },
    {
        heading: 'Intellectual Property',
        text: '7.1. All content, trademarks, and other intellectual property associated with the Service are owned by our company or its licensors. You may not use any of our intellectual property without our prior written consent.\n\n7.2. You retain ownership of any data you input into the Service, but you grant us a license to use, reproduce, and analyze such data as necessary to provide and improve the Service.',
    },
    {
        heading: 'Privacy',
        text: '8.1. Your use of the Service is also governed by our Privacy Policy, which describes how we collect, use, and protect your personal information.\n\n8.2. By using the Service, you consent to the collection and use of your information in accordance with our Privacy Policy.',
    },
    {
        heading: 'Termination',
        text: '9.1. We reserve the right to suspend or terminate your access to the Service at our sole discretion, with or without cause, and with or without notice.\n\n9.2. You may terminate your subscription at any time by following the instructions provided in the Service. No refunds will be issued for any unused portion of the subscription term.',
    },
    {
        heading: 'Governing Law and Dispute Resolution',
        text: '10.1. These Terms are governed by and construed in accordance with the laws of India.\n\n10.2. Any disputes arising out of or in connection with these Terms or your use of the Service will be subject to the exclusive jurisdiction of the courts located in Bengaluru, India.',
    },
    {
        heading: 'Miscellaneous',
        text: (
            <>
                11.1. <Text style={{ fontWeight: 'bold' }}>Severability</Text>: If any provision of these Terms is found to be invalid or unenforceable, the remaining provisions will continue in full force and effect.{'\n\n'}
                11.2. <Text style={{ fontWeight: 'bold' }}>No Waiver</Text>: Our failure to enforce any right or provision of these Terms will not be deemed a waiver of such right or provision.{'\n\n'}
                11.3. <Text style={{ fontWeight: 'bold' }}>Assignment</Text>: We may assign these Terms, in whole or in part, at any time without notice to you. You may not assign these Terms without our prior written consent.{'\n\n'}
                11.4. <Text style={{ fontWeight: 'bold' }}>Entire Agreement</Text>: These Terms constitute the entire agreement between you and us regarding your use of the Service and supersede all prior or contemporaneous agreements and understandings.{'\n\n'}
                11.5. <Text style={{ fontWeight: 'bold' }}>Contact Us</Text>: If you have any questions about these Terms, please contact us.
            </>
        ),
    },
];

const TermsModal = ({ modalVisible, setModalVisible, setIsChecked }) => {
    const Presentation = useComponent('composites.TermsModal');

    return (
        <Presentation
            viewModel={{ visible: modalVisible, termsData: TERMS_DATA }}
            actions={{
                onAccept: () => {
                    setIsChecked(true);
                    setModalVisible(false);
                },
                onClose: () => setModalVisible(false),
            }}
        />
    );
};

export default TermsModal;
