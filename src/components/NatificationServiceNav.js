//NatificationServiceNav.js
import { CommonActions } from "@react-navigation/native";
import { NavigationContainerRef } from "@react-navigation/native";

let navigator = null;

function setTopLevelNavigator(navigationRef){
navigator = navigationRef;
}
function navigate(routeName, params) {
    if (navigator) {
      navigator.navigate(routeName, params);
    } else {
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