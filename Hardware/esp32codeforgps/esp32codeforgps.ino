void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("NEO-6M TEST");

  Serial2.begin(9600, SERIAL_8N1, 16, 17);
}

void loop() {
  if (Serial2.available()) {
    int c = Serial2.read();

    Serial.print("0x");

    if (c < 16) Serial.print("0");

    Serial.print(c, HEX);
    Serial.print(" ");

    if (c >= 32 && c <= 126) {
      Serial.print((char)c);
    }

    Serial.println();
  }
}