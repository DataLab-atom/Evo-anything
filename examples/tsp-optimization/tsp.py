"""
TSP (Traveling Salesman Problem) - Optimization Target
"""

import random
import math


def calculate_distance(city1, city2):
    """Calculate Euclidean distance between two cities."""
    return math.sqrt((city1[0] - city2[0])**2 + (city1[1] - city2[1])**2)


def calculate_total_distance(route, cities):
    """Calculate total distance for a given route."""
    total = 0
    for i in range(len(route) - 1):
        total += calculate_distance(cities[route[i]], cities[route[i + 1]])
    # Return to start
    total += calculate_distance(cities[route[-1]], cities[route[0]])
    return total


def solve_tsp_brute_force(cities):
    """
    Brute force TSP solution - finds optimal route but is slow.
    This is the target function to optimize.
    """
    n = len(cities)
    if n > 10:
        # Too slow for large n, fallback to random
        route = list(range(n))
        random.shuffle(route)
        return route
    
    best_route = None
    best_distance = float('inf')
    
    # Try all permutations
    from itertools import permutations
    for perm in permutations(range(n)):
        dist = calculate_total_distance(perm, cities)
        if dist < best_distance:
            best_distance = dist
            best_route = perm
    
    return list(best_route)


def generate_cities(n=20, seed=42):
    """Generate random cities."""
    random.seed(seed)
    return [(random.random() * 100, random.random() * 100) for _ in range(n)]


def run_benchmark():
    """Main benchmark function."""
    cities = generate_cities(20, 42)
    route = solve_tsp_brute_force(cities)
    distance = calculate_total_distance(route, cities)
    print(f"{distance:.2f}")


if __name__ == "__main__":
    run_benchmark()
