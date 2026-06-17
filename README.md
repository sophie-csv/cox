# CoolCast ATL

**Predictive pre-cooling for Atlanta’s existing buildings.**

Atlanta has **114 government buildings and 2,379 others** in this demo dataset — none LEED certified, none ENERGY STAR certified — all air conditioned, all running right now.

Many buildings cool at the wrong time: running hard early in the morning when spaces may be underused, then struggling during peak afternoon heat when electricity costs, grid stress, and emissions are at their worst.

**CoolCast ATL solves a timing problem.**

This is not a hardware-first solution. Most buildings already have the equipment they need. CoolCast focuses on changing **when** cooling happens, using forecasted weather and building characteristics to estimate smarter pre-cooling schedules.

## Live Demo

Add the GitHub Pages link here once published:

```text
https://sophie-csv.github.io/cox/
```

## The Problem

During peak demand hours, buildings across the city are all trying to cool themselves at the same time.

By early afternoon, outdoor temperatures can reach extreme levels, HVAC systems are under the most stress, energy prices are higher, and emissions are often at their worst.

Every building cooling reactively creates the same problem:

**Too much cooling demand at the wrong time.**

## The Solution

**CoolCast ATL changes when cooling happens.**

This strategy is called **load shifting**. Instead of waiting until peak heat arrives, buildings can pre-cool earlier in the day when conditions are more favorable, then reduce cooling strain during peak demand hours.

CoolCast is a predictive scheduling algorithm that determines when existing buildings should pre-cool based on:

* Weather conditions
* Heat risk
* Building characteristics
* Square footage
* Estimated energy savings potential
* Electricity cost
* Carbon emissions factor

The website is only the interface. It visualizes what the CoolCast algorithm could do at city scale.

## Why Pre-Cooling Matters

Pre-cooling has already been studied as an HVAC efficiency strategy. A 10-year economic analysis published through ScienceDirect found that pre-cooling produced the highest return on investment among the HVAC efficiency strategies studied.

The concept has also been proven at scale. Willis Tower in Chicago implemented predictive HVAC control and reduced peak electrical demand by approximately **2 megawatts**. The building shifted **1,530 megawatt-hours** of energy away from peak demand periods, avoided approximately **900 tons of CO₂ emissions**, and saved roughly **$250,000 per year**.

And that was just one building.

CoolCast ATL asks:

**What if an entire city worked the same way?**

## How the Demo Works

The CoolCast ATL dashboard shows how predictive pre-cooling could apply across Atlanta buildings.

### 1. Weather Modes

The weather section has two modes:

**Fixed Temperature Mode**
Users can model a hot Atlanta day by manually adjusting the outdoor temperature.

**Real-Time Weather Mode**
When real-time weather is turned on, the app pulls current Atlanta weather data and recalculates estimated savings based on current conditions.

### 2. Building Groups

Users can choose a building group:

* Atlanta Government Buildings
* General Commercial Buildings
* Public Spaces
* All Buildings

The map and savings metrics update based on the selected group.

### 3. Time Scale

Users can view predicted savings across different time scales:

* Daily
* Monthly
* Yearly

The dashboard estimates:

* kWh saved
* Cost saved
* Carbon emissions avoided
* Total square footage analyzed

### 4. Clickable Map

Each map marker represents a building from the dataset.

When a building is clicked, the dashboard displays building-level estimated values, showing how the CoolCast model could apply to one site at a time.

### 5. Transparent Assumptions

The model uses a simple estimation formula based on:

* Building square footage
* Outdoor temperature
* Cooling setpoints
* Electricity rate
* Carbon emissions factor
* Estimated cooling energy intensity

Question mark icons in the dashboard explain assumptions and connect the model to supporting research.

## Project Formula

At a high level, CoolCast estimates savings using:

```text
Estimated Energy Saved = Building Square Footage × Cooling Energy Intensity × Temperature Adjustment Factor × Load Shift Savings Factor
```

Then:

```text
Estimated Cost Saved = Estimated Energy Saved × Electricity Rate
```

And:

```text
Estimated Carbon Avoided = Estimated Energy Saved × Emissions Factor
```

These calculations are intended for hackathon demonstration purposes. A real deployment would require building-specific utility data, HVAC system details, occupancy schedules, and engineering validation.

## Atlanta Climate Connection

Atlanta’s Climate Resilient ATL plan commits the city to a **59% reduction in greenhouse gas emissions by 2030**. That plan was built with input from more than **2,100 Atlanta residents**.

CoolCast ATL is designed as a deployable implementation tool for that goal.

It is especially practical because it focuses on infrastructure the city already owns, already operates, and already tracks through building energy reporting policies such as the Commercial Buildings Energy Efficiency Ordinance.

## Why This Is Regenerative

CoolCast is not a one-time fix.

Every morning, the system can pull a new forecast.
Every building can receive a new pre-cooling schedule.
Every day, the system can improve city energy performance automatically.

The value compounds over time because the same model can keep running without requiring constant human intervention.

## Tech Stack

This project may include:

* HTML
* CSS
* JavaScript
* GeoJSON
* GitHub Pages
* Weather data integration
* Building energy calculations
* Interactive mapping

## Dataset

The demo uses an Atlanta building dataset with location and building information.

The dataset may include:

* Building name
* Address
* Building category
* Square footage
* Latitude
* Longitude
* Estimated kWh saved
* Estimated cost saved
* Estimated carbon avoided

The first demo group focuses on buildings that are **not LEED certified** and **not ENERGY STAR certified**, making them potential candidates for energy efficiency improvements.

## Limitations

This is a hackathon prototype, not a final building automation system.

Current limitations include:

* Savings are estimated, not measured
* The model does not directly control HVAC systems
* Building automation system compatibility is not confirmed
* Actual utility interval data is not included
* HVAC equipment type is not verified for every building
* Real-world deployment would require engineering review

## Future Improvements

Future versions of CoolCast ATL could include:

* Real-time hourly forecast integration
* Building automation system compatibility scoring
* Peak-demand utility rate modeling
* Heat-vulnerability neighborhood scoring
* Public-health benefit estimates
* Top 10–20 priority building ranking
* More detailed building thermal mass estimates
* Integration with city energy benchmarking data
* Automated daily pre-cooling schedule generation

## Core Pitch

CoolCast ATL is a city-scale predictive pre-cooling model.

It helps answer one main question:

**How can Atlanta use the buildings it already has to cut energy costs, reduce carbon emissions, and lower peak cooling demand?**

The answer is not always new hardware.

Sometimes, the answer is better timing.
