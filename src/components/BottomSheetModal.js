<View style={styles.modalContent}>
        <View style={styles.iconContainer}>
          <Info size={64} color="#00000080" />
        </View>
        <Text style={styles.title}>
          Please login to your broker to continue investments
        </Text>
        <View style={styles.inputContainer}>

          {broker === 'IIFL Securities' && (
            <View>
              <TextInput
                style={styles.input}
                value={clientCode}
                placeholder="Client Code"
                editable={false}
              />
              <Text style={styles.label}>Client Code</Text>
              <TextInput
                style={styles.input}
                value={my2pin}
                placeholder="My2Pin"
                editable={false}
              />
              <Text style={styles.label}>My2Pin</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Password"
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={() => setShowPassword(prev => !prev)}
                >
                  {showPassword ? <Eye size={24} color="#00000060" /> : <EyeOff size={24} color="#00000060" />}
                </TouchableOpacity>
                <Text style={styles.label}>Password</Text>
              </View>
            </View>
          )}
          {broker === 'Kotak' && (
            <View>
              <TextInput
                style={styles.input}
                value={panNumber || mobileNumber}
                placeholder={panNumber ? 'Pan Number' : 'Mobile Number'}
                editable={false}
              />
              <Text style={styles.label}>{panNumber ? 'Pan Number' : 'Mobile Number'}</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Password"
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={() => setShowPassword(prev => !prev)}
                >
                  {showPassword ? <Eye size={24} color="#00000060" /> : <EyeOff size={24} color="#00000060" />}
                </TouchableOpacity>
                <Text style={styles.label}>Password</Text>
              </View>
              {openOtpBox && (
                <>
                  <View style={styles.passwordContainer}>
                    <TextInput
                      style={styles.input}
                      value={mpin}
                      onChangeText={setMpin}
                      placeholder="Mpin"
                      keyboardType="numeric"
                      secureTextEntry={!showMpin}
                    />
                    <TouchableOpacity
                      style={styles.eyeIcon}
                      onPress={() => setShowMpin(prev => !prev)}
                    >
                      <Info size={64} />
                    </TouchableOpacity>
                    <Text style={styles.label}>Mpin</Text>
                  </View>
                  <TextInput
                    style={styles.input}
                    value={otp}
                    onChangeText={setOtp}
                    placeholder="Otp"
                    keyboardType="numeric"
                  />
                  <Text style={styles.label}>Otp</Text>
                  <TouchableOpacity
                    style={styles.submitButton}
                    onPress={handleKotakLogin}
                    disabled={loginLoading}
                  >
                    {loginLoading ? <ActivityIndicator size="small" color="#ffffff" /> : <Text style={styles.submitButtonText}>Submit</Text>}
                  </TouchableOpacity>
                </>
              )}
              {!openOtpBox && (
                <TouchableOpacity
                  style={styles.submitButton}
                  onPress={updateKotakSecretKey}
                  disabled={loginLoading}
                >
                  {loginLoading ? <ActivityIndicator size="small" color="#ffffff" /> : <Text style={styles.submitButtonText}>Update Key</Text>}
                </TouchableOpacity>
              )}
            </View>
          )}
          {broker === 'ICICI Direct' && (
            <TouchableOpacity
              style={styles.submitButton}
              onPress={() => {}}
              disabled={loginLoading}
            >
              {loginLoading ? <ActivityIndicator size="small" color="#ffffff" /> : <Text style={styles.submitButtonText}>Submit</Text>}
            </TouchableOpacity>
          )}
        </View>
        {showSuccessMsg && (
          <Text style={styles.successMessage}>Login successful</Text>
        )}
      </View>