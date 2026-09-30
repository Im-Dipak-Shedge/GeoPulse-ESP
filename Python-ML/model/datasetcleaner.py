import pandas as pd

# Load the dataset
df = pd.read_csv('training_data.csv')

# Drop the gyroscope columns
df_cleaned = df.drop(columns=['GyroX', 'GyroY', 'GyroZ'])

# Save the updated dataset
df_cleaned.to_csv('training_data_no_gyro.csv', index=False)