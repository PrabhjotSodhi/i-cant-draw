Draw how Uber matched riders to drivers around 2015. The DISCO dispatch system sits in the middle, sharded with Ringpop. Rider requests reach it through the demand service. It asks a geospatial index of S2 cells for drivers near the pickup, ranks them by road ETA using maps data, keeps dispatch state in Riak, and offers the ride to a driver through the supply service.

Sources:

- Matt Ranney, How Uber Scales Their Real-time Market Platform, QCon London 2015, written up at https://highscalability.com/how-uber-scales-their-real-time-market-platform/
- Uber Engineering, Ringpop open source, 2016: https://www.uber.com/en-US/blog/ringpop-open-source-nodejs-library/
