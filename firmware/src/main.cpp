#include <Arduino.h>
#include <DHT.h>
#include <LiquidCrystal_I2C.h>

// Sensor pins
#define DHT_PIN 2
#define MQ2_PIN A0
#define DHT_TYPE DHT22

// LED pins
#define GREEN_LED 4
#define YELLOW_LED 5
#define ORANGE_LED 6
#define RED_LED 7

// LCD and DHT22
LiquidCrystal_I2C lcd(0x27, 16, 2);
DHT dht(DHT_PIN, DHT_TYPE);

// Example thresholds for raw analog readings; these are not calibrated PPM.
const int GAS_LOW = 250;
const int GAS_MEDIUM = 450;
const int GAS_HIGH = 650;

void setup() {
  Serial.begin(9600);

  lcd.init();
  lcd.backlight();
  dht.begin();

  pinMode(MQ2_PIN, INPUT);
  pinMode(GREEN_LED, OUTPUT);
  pinMode(YELLOW_LED, OUTPUT);
  pinMode(ORANGE_LED, OUTPUT);
  pinMode(RED_LED, OUTPUT);

  digitalWrite(GREEN_LED, LOW);
  digitalWrite(YELLOW_LED, LOW);
  digitalWrite(ORANGE_LED, LOW);
  digitalWrite(RED_LED, LOW);
}

void loop() {
  static unsigned long lastSensorRead = 0;
  const unsigned long now = millis();
  if (now - lastSensorRead < 2000) return;
  lastSensorRead = now;

  const float humidity = dht.readHumidity();
  const float temperature = dht.readTemperature();
  const int gasValue = analogRead(MQ2_PIN);

  if (isnan(humidity) || isnan(temperature)) {
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("DHT22 read error");
    lcd.setCursor(0, 1);
    lcd.print("Gas:");
    lcd.print(gasValue);

    // Keep the MQ-2 reading visible even when the DHT22 is unavailable.
    Serial.print("DHT22 read error, Gas Level: ");
    Serial.println(gasValue);
  } else {
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("H:");
    lcd.print(humidity, 3);
    lcd.print("%");

    lcd.setCursor(0, 1);
    lcd.print("T:");
    lcd.print(temperature, 1);
    lcd.print("C G:");
    lcd.print(gasValue);

    Serial.print("Temperature: ");
    Serial.print(temperature);
    Serial.print(" C, Humidity: ");
    Serial.print(humidity, 3);
    Serial.print("%, Gas Level: ");
    Serial.println(gasValue);
  }

  digitalWrite(GREEN_LED, LOW);
  digitalWrite(YELLOW_LED, LOW);
  digitalWrite(ORANGE_LED, LOW);
  digitalWrite(RED_LED, LOW);

  if (gasValue < GAS_LOW) {
    digitalWrite(GREEN_LED, HIGH);
  } else if (gasValue < GAS_MEDIUM) {
    digitalWrite(YELLOW_LED, HIGH);
  } else if (gasValue < GAS_HIGH) {
    digitalWrite(ORANGE_LED, HIGH);
  } else {
    digitalWrite(RED_LED, HIGH);
  }
}
