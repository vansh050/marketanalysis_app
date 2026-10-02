//NatificationServiceNav.js
import { CommonActions } from "@react-navigation/native";
import { NavigationContainerRef } from "@react-navigation/native";

let navigator = null;
let pendingNavigation = null;

function setTopLevelNavigator(navigationRef){
navigator = navigationRef;
if (navigator && pendingNavigation) {
  const {routeName, params} = pendingNavigation;
  pendingNavigation = null;
  navigator.navigate(routeName, params);
}
}
function navigate(routeName, params) {
    if (navigator) {
      navigator.navigate(routeName, params);
    } else {
      pendingNavigation = {routeName, params};
      console.log("Navigator is not defined yet.");
    }
  }
  
function goBack(){
navigator?.dispatch(CommonActions.goBack());
}
export default{
setTopLevelNavigator,
navigate,
goBack
}
