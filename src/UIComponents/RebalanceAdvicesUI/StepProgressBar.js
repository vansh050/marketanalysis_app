import { View, Text, StyleSheet } from "react-native"
import { Check } from "lucide-react-native"

import { designColor, designFont } from '../../design/literalTokens';

const StepProgressBar = ({ steps, currentStep }) => {
 // console.log("stepss--",steps);
  return (
    <View style={styles.container}>
      <View style={styles.stepsContainer}>
        {steps.map((step, index) => {
          const stepNumber = index + 1
          const isCompleted = stepNumber < currentStep
          const isCurrent = stepNumber === currentStep

          return (
            <View key={index} style={styles.stepWrapper}>
              {/* Step Circle */}
              <View style={[
                styles.stepCircle,
                isCurrent ? styles.currentCircle : isCompleted ? styles.completedCircle : styles.upcomingCircle,
              ]}>
                {isCompleted ? (
                  <Check size={20} color={designColor('fff')} />
                ) : (
                  <Text style={[
                    styles.stepNumber,
                    isCurrent ? styles.currentStepNumber : styles.upcomingStepNumber,
                  ]}>
                    {stepNumber}
                  </Text>
                )}
              </View>
              {/* Connector as dotted dashed line except last */}
              {index < steps.length - 1 && (
                <View style={[
                  styles.connector,
                  isCompleted ? styles.completedConnector : styles.upcomingConnector,
                ]} />
              )}
              {/* Step Label */}
              <Text style={[
               styles.stepLabel,
               isCurrent ? styles.currentStepLabel : isCompleted ? styles.completedStepLabel : styles.upcomingStepLabel,
             ]}>
               Step {stepNumber}
             </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const CIRCLE_SIZE = 34
const CONNECTOR_WIDTH = 50
const CONNECTOR_HEIGHT = 2

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
    paddingHorizontal: 0,
  },
  stepsContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stepWrapper: {
    alignItems: "center",
    flex: 1,
    position: "relative",
    minWidth: 0,
    paddingBottom: 8,
  },
  stepCircle: {
    width: 25,
    height:25,
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: designColor('fff'),
    borderWidth: 1,
    borderColor: designColor('7c7c7c'),
    marginBottom: 6,
    zIndex: 2,
  },
  currentCircle: {
    backgroundColor: designColor('22a100'),
    borderColor: designColor('22a100'),
  },
  completedCircle: {
    backgroundColor: designColor('22a100'),
    borderColor: designColor('22a100'),
  },
  upcomingCircle: {
    backgroundColor: designColor('f0f0f0'),
    borderColor: designColor('b0b0b0'),
  },
  stepNumber: {
    fontSize: 13,
    fontFamily:designFont('Poppins-Medium'),
    marginTop:3,
  },
  currentStepNumber: {
    color: designColor('fff'),
  },
  upcomingStepNumber: {
    color: designColor('b0b0b0'),
  },
  connector: {
    position: "absolute",
    top: CIRCLE_SIZE / 2.5,
    left: CIRCLE_SIZE+18,
    width: CONNECTOR_WIDTH+80,
    height: CONNECTOR_HEIGHT,
    zIndex: 1,
    borderBottomWidth: 2,
    borderStyle: "dashed",
    borderColor: designColor('a0a0a0'),
  },
  completedConnector: {
    borderColor: designColor('22a100'),
  },
  upcomingConnector: {
    borderColor: designColor('a0a0a0'),
  },
  stepLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: designColor('a0a0a0'),
    textAlign: "center",
  },
  currentStepLabel: {
    color: designColor('222222'),
  },
  completedStepLabel: {
    color: designColor('22a100'),
  },
  upcomingStepLabel: {
    color: designColor('a0a0a0'),
  },
})

export default StepProgressBar