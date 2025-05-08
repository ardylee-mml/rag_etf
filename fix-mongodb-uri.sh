#!/bin/bash

# List of files to fix
FILES=(
  "all-queries-server.js"
  "analyze-collections.js"
  "basic-server.js"
  "demo-server.js"
  "examine-questions.js"
  "explore-events.js"
  "explore-questions.js"
  "final-demo-server.js"
  "final-server.js"
  "find-question-mapping.js"
  "fixed-zone-server.js"
  "improved-server.js"
  "player-server.js"
  "simple-player-server.js"
  "simple-zone-server.js"
  "test-data.js"
  "zone-server.js"
)

# Loop through each file and replace the MongoDB URI
for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "Fixing $file..."
    # Replace hardcoded MongoDB URI with environment variable
    sed -i '' 's|mongodb+srv://mmluser-ro:1wzBCKHp2hBMCi69@clustermetamindinglab.qa8tyi1.mongodb.net/mmldb|process.env.MONGODB_URI|g' "$file"
    sed -i '' 's|"mongodb+srv://mmluser-ro:1wzBCKHp2hBMCi69@clustermetamindinglab.qa8tyi1.mongodb.net/mmldb"|process.env.MONGODB_URI|g' "$file"
    sed -i '' "s|'mongodb+srv://mmluser-ro:1wzBCKHp2hBMCi69@clustermetamindinglab.qa8tyi1.mongodb.net/mmldb'|process.env.MONGODB_URI|g" "$file"
    sed -i '' 's|mongodb+srv://mmluser-ro:1wzBCKHp2hBMCi69@clustermetamindinglab.qa8tyi1.mongodb.net/mmldb?retryWrites=true&w=majority|process.env.MONGODB_URI|g' "$file"
    sed -i '' "s|'mongodb+srv://mmluser-ro:1wzBCKHp2hBMCi69@clustermetamindinglab.qa8tyi1.mongodb.net/mmldb?retryWrites=true&w=majority'|process.env.MONGODB_URI|g" "$file"
    
    # Make sure the file loads environment variables
    if ! grep -q "require('dotenv').config()" "$file"; then
      sed -i '' '1s/^/require(\'dotenv\').config();\n/' "$file"
    fi
  else
    echo "File $file not found, skipping..."
  fi
done

echo "All files fixed!"
