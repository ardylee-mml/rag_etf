# Escape To Freedom Game Database Insights

## Database Overview

The database contains information about the "Escape To Freedom" game, tracking player activities, game elements, and performance metrics. Here's a summary of the key collections:

### Collections Summary

1. **Players Collection (304,814 documents)**
   - Contains player profiles with information like name, region, language
   - Each player has a unique id field
   - Players are from various regions with different language preferences

2. **Events Collection (10,929,576 documents)**
   - Largest collection in the database
   - Records all player activities in the game
   - Main event types: item interactions, zone movements, sign-ins/outs, question responses
   - Events reference players, items, zones, and questions through their IDs
   - Event volume has increased significantly from 2023 to 2024-2025

3. **Zones Collection (65 documents)**
   - Defines key areas within the game
   - Each zone has a name, description, and is associated with an application

4. **Items Collection (100 documents)**
   - Defines collectible or interactive objects in the game
   - Items have names, descriptions, and tags (e.g., "health", "hunger")
   - Used to track player engagement with game objects

5. **Questions Collection (56 documents)**
   - Contains questions presented to players during gameplay
   - Each question has multiple choices
   - Used to assess player learning and understanding

6. **Leaderboards Collection (141,349 documents)**
   - Tracks player rankings and scores
   - Organized by stages or categories (e.g., "stage-1")
   - Contains score amounts for each player

7. **Campaigns Collection (3 documents)**
   - Defines game campaigns with objectives and targets
   - References multiple questions through questionIds
   - Has status tracking (e.g., "Draft")

## Key Relationships

1. **Players → Events**
   - One-to-many relationship: Each player can have multiple events
   - Events reference players through player_id
   - Top players have thousands of recorded events

2. **Items → Events**
   - One-to-many relationship: Each item can be involved in multiple events
   - Item events track when players interact with game objects

3. **Zones → Events**
   - One-to-many relationship: Each zone can have multiple entry/exit events
   - Zone events track player movement through the game environment

4. **Questions → Events**
   - One-to-many relationship: Each question can be answered multiple times
   - Question events track player responses and learning progress

5. **Players → Leaderboards**
   - One-to-many relationship: Each player can have multiple leaderboard entries
   - Leaderboards track player performance across different stages

## Temporal Patterns

- Game activity has increased significantly from 2023 to 2024-2025
- Peak activity months: July-August 2024 (over 1.4M events each)
- The game has been active from February 2023 through April 2025
- Most recent data is from April 2025

## Player Engagement

- Top players have 1,000-5,000+ recorded events
- Player ID 1353605122 is the most active with 5,142 events
- Players come from diverse regions with various language preferences
- Leaderboard scores vary widely, suggesting different levels of player achievement

## Game Structure

- The game appears to be organized into stages (referenced in leaderboards)
- Players navigate through different zones, collect items, and answer questions
- Questions focus on refugee-related topics (e.g., Amnesty International's role)
- Items are categorized with tags like "health" and "hunger"

## Recommendations for Analysis

1. **Player Journey Analysis**
   - Track individual player paths through zones
   - Analyze item collection patterns
   - Evaluate question response accuracy

2. **Learning Assessment**
   - Analyze question response patterns
   - Identify commonly missed questions
   - Measure knowledge improvement over time

3. **Engagement Metrics**
   - Calculate average session duration
   - Identify drop-off points
   - Measure retention rates

4. **Performance Optimization**
   - Identify zones with technical issues
   - Analyze game performance during peak usage periods

5. **Content Effectiveness**
   - Evaluate which items and zones generate most engagement
   - Assess which questions are most effective for learning
