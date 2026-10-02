const fs = require('fs');
const path = require('path');

const customerSurfaces = {
  'src/screens/Authentication/OnboardingScreen.js': 'screens.OnboardingScreen',
  'src/screens/Authentication/PhoneLoginScreen.js': 'screens.PhoneLoginScreen',
  'src/components/AdviceScreenComponents/AdviceCartScreen.js': 'screens.AdviceCartScreen',
  'src/components/WebViewScreen.js': 'screens.WebViewScreen',
  'src/screens/Home/TradePnLScreen.js': 'screens.TradePnLScreen',
  'src/screens/Home/RecommendationMessagesScreen.js': 'screens.RecommendationMessagesScreen',
  'src/screens/Courses/WebinarsListScreen.js': 'screens.WebinarsListScreen',
  'src/screens/Courses/WebinarDetailScreen.js': 'screens.WebinarDetailScreen',
  'src/screens/Courses/MyCoursesScreen.js': 'screens.MyCoursesScreen',
  'src/screens/Courses/CourseDetailScreen.js': 'screens.CourseDetailScreen',
  'src/screens/Rebalance/CurrentHoldingsScreen.js': 'screens.CurrentHoldingsScreen',
  'src/screens/Rebalance/RebalanceReviewScreen.js': 'screens.RebalanceReviewScreen',
  'src/screens/Rebalance/ExecutionStatusScreen.js': 'screens.ExecutionStatusScreen',
  'src/screens/Home/DeleteAccountScreen.js': 'screens.DeleteAccountScreen',
  'src/screens/Home/UpdateEmailScreen.js': 'screens.UpdateEmailScreen',
  'src/screens/Home/MySubscriptionsScreen.js': 'screens.MySubscriptionsScreen',
  'src/screens/Home/WishSearch.js': 'screens.WishSearch',
  'src/screens/Home/NewsScreen/NewsScreen.js': 'screens.NewsScreen',
  'src/screens/Home/NewsScreen/NewsInfoScreen.js': 'screens.NewsInfoScreen',
  'src/screens/Home/ResearchReportScreen.js': 'screens.ResearchReportScreen',
  'src/screens/Home/SubscriptionScreen.js': 'screens.SubscriptionScreen',
  'src/screens/Home/AfterSubscriptionScreen.js': 'screens.AfterSubscriptionScreen',
  'src/screens/Home/PushNotificationScreen.js': 'screens.PushNotificationScreen',
  'src/components/HomeScreenComponents/KnowledgeHub.js': 'screens.KnowledgeHub',
  'src/screens/Invest/InvestFlowScreen.js': 'screens.InvestFlowScreen',
};

describe('customer design coverage', () => {
  const registry = fs.readFileSync(
    path.join(process.cwd(), 'designs/default/index.js'),
    'utf8',
  );

  test.each(Object.entries(customerSurfaces))(
    '%s delegates its complete visible surface to %s',
    (relativePath, key) => {
      const controller = fs.readFileSync(
        path.join(process.cwd(), relativePath),
        'utf8',
      );
      const designFile = path.join(
        process.cwd(),
        'designs/default/screens',
        `${key.replace('screens.', '')}.js`,
      );

      expect(controller).toContain(`useComponent('${key}')`);
      expect(controller).not.toContain('StyleSheet.create(');
      expect(fs.existsSync(designFile)).toBe(true);
      expect(registry).toContain(`'${key}':`);
    },
  );
});
