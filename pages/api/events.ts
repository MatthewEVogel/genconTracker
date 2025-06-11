import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'GET') {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 100;
      const day = req.query.day as string;
      const search = req.query.search as string;
      const startTime = req.query.startTime as string;
      const endTime = req.query.endTime as string;
      const ageRatings = req.query.ageRatings as string;
      const eventTypes = req.query.eventTypes as string;
      const maxParticipants = req.query.maxParticipants as string;
      
      const skip = (page - 1) * limit;
      
      // If any filtering is applied, we need to get all events first, filter them, then paginate
      const hasFilters = (day && day !== 'All Days') || search || startTime || endTime || ageRatings || eventTypes || maxParticipants;
      
      if (hasFilters) {
        // Get all events to filter
        const allEvents = await prisma.event.findMany({
          orderBy: {
            startDateTime: 'asc'
          },
          select: {
            id: true,
            title: true,
            shortDescription: true,
            eventType: true,
            gameSystem: true,
            startDateTime: true,
            duration: true,
            endDateTime: true,
            ageRequired: true,
            experienceRequired: true,
            materialsRequired: true,
            cost: true,
            location: true,
            ticketsAvailable: true,
          }
        });

        let filteredEvents = allEvents;

        // Filter by search term
        if (search && search.trim()) {
          const searchTerm = search.toLowerCase().trim();
          filteredEvents = filteredEvents.filter(event => 
            event.title.toLowerCase().includes(searchTerm) ||
            (event.shortDescription && event.shortDescription.toLowerCase().includes(searchTerm)) ||
            (event.eventType && event.eventType.toLowerCase().includes(searchTerm)) ||
            (event.gameSystem && event.gameSystem.toLowerCase().includes(searchTerm)) ||
            event.id.toLowerCase().includes(searchTerm)
          );
        }

        // Filter by day
        if (day && day !== 'All Days') {
          filteredEvents = filteredEvents.filter(event => {
            if (!event.startDateTime) return false;
            try {
              const eventDate = new Date(event.startDateTime);
              const dayOfWeek = eventDate.toLocaleDateString('en-US', { weekday: 'long' });
              return dayOfWeek === day;
            } catch {
              return false;
            }
          });
        }

        // Filter by start time
        if (startTime && startTime.trim()) {
          filteredEvents = filteredEvents.filter(event => {
            if (!event.startDateTime) return false;
            try {
              const eventDate = new Date(event.startDateTime);
              const eventTime = eventDate.toLocaleTimeString('en-US', { 
                hour12: false, 
                hour: '2-digit', 
                minute: '2-digit' 
              });
              return eventTime >= startTime.trim();
            } catch {
              return false;
            }
          });
        }

        // Filter by end time
        if (endTime && endTime.trim()) {
          filteredEvents = filteredEvents.filter(event => {
            if (!event.endDateTime) return false;
            try {
              const eventDate = new Date(event.endDateTime);
              const eventTime = eventDate.toLocaleTimeString('en-US', { 
                hour12: false, 
                hour: '2-digit', 
                minute: '2-digit' 
              });
              return eventTime <= endTime.trim();
            } catch {
              return false;
            }
          });
        }

        // Filter by age ratings
        if (ageRatings && ageRatings.trim()) {
          const selectedAgeRatings = ageRatings.split(',').map(rating => rating.trim());
          filteredEvents = filteredEvents.filter(event => {
            if (!event.ageRequired) return selectedAgeRatings.includes('Not Specified');
            return selectedAgeRatings.some(rating => 
              event.ageRequired && event.ageRequired.toLowerCase().includes(rating.toLowerCase())
            );
          });
        }

        // Filter by event types
        if (eventTypes && eventTypes.trim()) {
          const selectedEventTypes = eventTypes.split(',').map(type => type.trim());
          filteredEvents = filteredEvents.filter(event => {
            if (!event.eventType) return selectedEventTypes.includes('Not Specified');
            return selectedEventTypes.some(type => 
              event.eventType && event.eventType.toLowerCase().includes(type.toLowerCase())
            );
          });
        }

        // Filter by max participants
        if (maxParticipants && maxParticipants.trim()) {
          const maxParticipantsNum = parseInt(maxParticipants.trim());
          if (!isNaN(maxParticipantsNum)) {
            filteredEvents = filteredEvents.filter(event => {
              if (!event.ticketsAvailable) return false;
              return event.ticketsAvailable <= maxParticipantsNum;
            });
          }
        }

        // Apply pagination to filtered results
        const totalEvents = filteredEvents.length;
        const paginatedEvents = filteredEvents.slice(skip, skip + limit);
        const totalPages = Math.ceil(totalEvents / limit);

        return res.status(200).json({ 
          events: paginatedEvents,
          pagination: {
            currentPage: page,
            totalPages,
            totalEvents,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
          }
        });
      } else {
        // For "All Days" with no filters, use regular database pagination
        const totalEvents = await prisma.event.count();
        
        const events = await prisma.event.findMany({
          skip,
          take: limit,
          orderBy: {
            startDateTime: 'asc'
          },
          select: {
            id: true,
            title: true,
            shortDescription: true,
            eventType: true,
            gameSystem: true,
            startDateTime: true,
            duration: true,
            endDateTime: true,
            ageRequired: true,
            experienceRequired: true,
            materialsRequired: true,
            cost: true,
            location: true,
            ticketsAvailable: true,
          }
        });

        const totalPages = Math.ceil(totalEvents / limit);

        return res.status(200).json({ 
          events,
          pagination: {
            currentPage: page,
            totalPages,
            totalEvents,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
          }
        });
      }
    } catch (error) {
      console.error('Error fetching events:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).json({ error: `Method ${req.method} not allowed` });
  }
}
