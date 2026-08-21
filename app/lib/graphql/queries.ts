// Sessions
export const getSession = /* GraphQL */ `
  query GetSession($id: ID!) {
    getSession_prueba_whatsapp(id: $id) {
      id
      sessionId
      token
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
  query ListSessions(
    $filter: ModelSession_prueba_whatsappFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listSession_prueba_whatsapps(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items {
        id
        sessionId
        token
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
    getGame_prueba_whatsapp(id: $id) {
      id
      name
      description
      icon
    }
  }
`;

export const listGames = /* GraphQL */ `
  query ListGames(
    $filter: ModelGame_prueba_whatsappFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listGame_prueba_whatsapps(filter: $filter, limit: $limit, nextToken: $nextToken) {
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
    getBet_prueba_whatsapp(id: $id) {
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
  query ListBets(
    $filter: ModelBet_prueba_whatsappFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listBet_prueba_whatsapps(filter: $filter, limit: $limit, nextToken: $nextToken) {
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
    getConversation_prueba_whatsapp(id: $id) {
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
  query ListConversations(
    $filter: ModelConversation_prueba_whatsappFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listConversation_prueba_whatsapps(filter: $filter, limit: $limit, nextToken: $nextToken) {
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
