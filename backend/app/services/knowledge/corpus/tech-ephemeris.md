id: tech-ephemeris
title: How positions are calculated
category: technical
version: 1
aliases: ephemeris, swiss ephemeris, how are planets calculated, accuracy, calculation engine
---
Planet positions come from the Swiss Ephemeris, a standard astronomical library, and not from tables or estimates. The application's calculation engine produces every position, house and aspect, and the AI only interprets what the engine has already calculated; it never calculates or corrects a position itself. Accuracy is far finer than any interpretation needs, and the engine and calculation version are recorded with each result.
