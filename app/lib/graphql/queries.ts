// Sessions
export const getSession = /* GraphQL */ `
  query GetSession($id: ID!) {
    getSession(id: $id) {
      id
      sessionId
      token
      documento
      nombre
      latitude
      longitude
      createdAt
      expiresAt
      phoneNumber
      active
    }
  }
`;

export const listSessions = /* GraphQL */ `
  query ListSessions($filter: TableSessionFilterInput, $limit: Int, $nextToken: String) {
    listSessions(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items {
        id
        sessionId
        token
        documento
        nombre
        latitude
        longitude
        createdAt
        expiresAt
        phoneNumber
        active
      }
      nextToken
    }
  }
`;

// Games
export const getGame = /* GraphQL */ `
  query GetGame($id: ID!) {
    getGame(id: $id) {
      id
      name
      description
      icon
    }
  }
`;

export const listGames = /* GraphQL */ `
  query ListGames($limit: Int, $nextToken: String) {
    listGames(limit: $limit, nextToken: $nextToken) {
      items {
        id
        name
        description
        icon
      }
      nextToken
    }
  }
`;

// Bets
export const getBet = /* GraphQL */ `
  query GetBet($id: ID!) {
    getBet(id: $id) {
      id
      sessionId
      gameId
      drawId
      drawName
      number
      amount
      paidAt
      source
      createdAt
    }
  }
`;

export const listBets = /* GraphQL */ `
  query ListBets($filter: TableBetFilterInput, $limit: Int, $nextToken: String) {
    listBets(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items {
        id
        sessionId
        gameId
        drawId
        drawName
        number
        amount
        paidAt
        source
        createdAt
      }
      nextToken
    }
  }
`;

// Conversations
export const getConversation = /* GraphQL */ `
  query GetConversation($id: ID!) {
    getConversation(id: $id) {
      id
      phoneNumber
      sessionId
      state
      selectedGame
      selectedDraw
      betNumber
      betAmount
      currentPage
      updatedAt
    }
  }
`;

export const listConversations = /* GraphQL */ `
  query ListConversations($filter: TableConversationFilterInput, $limit: Int, $nextToken: String) {
    listConversations(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items {
        id
        phoneNumber
        sessionId
        state
        selectedGame
        selectedDraw
        betNumber
        betAmount
        currentPage
        updatedAt
      }
      nextToken
    }
  }
`;
